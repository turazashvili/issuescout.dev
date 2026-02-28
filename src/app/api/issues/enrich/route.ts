import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import { connectToDatabase } from "@/lib/mongodb";
import { CachedIssue } from "@/models/CachedIssue";
import type { DifficultyLevel, HealthDetails } from "@/types";

interface IssueToEnrich {
  id: string;
  title: string;
  body: string;
  labels: string[];
  repoFullName: string; // "owner/name"
  language: string;
}

interface EnrichmentResult {
  issueId: string;
  healthScore: number;
  healthDetails: HealthDetails;
  difficulty: DifficultyLevel;
  difficultyReason: string;
  difficultyUsedAI: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { issues } = (await request.json()) as { issues: IssueToEnrich[] };

    if (!issues?.length) {
      return NextResponse.json({ enrichments: [] });
    }

    // Cap at 100 issues per request
    const toEnrich = issues.slice(0, 100);

    const session = await auth();
    const userToken = session?.accessToken;

    await connectToDatabase();

    // Step 1: Check cache for all issues at once (single DB query)
    const issueIds = toEnrich.map((i) => i.id);
    const cachedDocs = await CachedIssue.find({ issueId: { $in: issueIds } });
    const cacheMap = new Map(cachedDocs.map((doc) => [doc.issueId, doc]));

    // Step 2: Separate cached vs uncached
    const enrichments: EnrichmentResult[] = [];
    const uncachedIssues: IssueToEnrich[] = [];

    for (const issue of toEnrich) {
      const cached = cacheMap.get(issue.id);
      if (cached) {
        enrichments.push({
          issueId: issue.id,
          healthScore: cached.healthScore,
          healthDetails: cached.healthDetails as HealthDetails,
          difficulty: cached.difficulty as DifficultyLevel,
          difficultyReason: cached.difficultyReason,
          difficultyUsedAI: cached.difficultyUsedAI || false,
        });
      } else {
        uncachedIssues.push(issue);
      }
    }

    if (uncachedIssues.length === 0) {
      return NextResponse.json({ enrichments });
    }

    // Step 3: Deduplicate repos — one health score call per unique repo
    const uniqueRepos = new Map<string, { owner: string; name: string }>();
    for (const issue of uncachedIssues) {
      if (!uniqueRepos.has(issue.repoFullName)) {
        const [owner, name] = issue.repoFullName.split("/");
        uniqueRepos.set(issue.repoFullName, { owner, name });
      }
    }

    // Step 4: Fetch health scores for all unique repos in parallel
    const repoHealthMap = new Map<
      string,
      { score: number; details: HealthDetails }
    >();

    const healthPromises = Array.from(uniqueRepos.entries()).map(
      async ([fullName, { owner, name }]) => {
        try {
          const result = await calculateHealthScore(owner, name, userToken);
          repoHealthMap.set(fullName, result);
        } catch {
          repoHealthMap.set(fullName, {
            score: 0,
            details: {
              score: 0,
              hasContributing: false,
              hasLicense: false,
              recentActivity: false,
              starCount: 0,
              communitySize: "unknown",
              responseTime: "unknown",
            },
          });
        }
      }
    );

    // Step 5: Estimate difficulty for all uncached issues in parallel
    const difficultyPromises = uncachedIssues.map(async (issue) => {
      const result = await estimateDifficulty(
        issue.title,
        issue.body || "",
        issue.labels
      );
      return { issueId: issue.id, ...result };
    });

    // Run health + difficulty in parallel
    const [, difficultyResults] = await Promise.all([
      Promise.all(healthPromises),
      Promise.all(difficultyPromises),
    ]);

    // Step 6: Combine results and cache
    const difficultyMap = new Map(
      difficultyResults.map((d) => [d.issueId, d])
    );

    const cacheWrites: Promise<unknown>[] = [];

    for (const issue of uncachedIssues) {
      const health = repoHealthMap.get(issue.repoFullName) || {
        score: 0,
        details: {
          score: 0,
          hasContributing: false,
          hasLicense: false,
          recentActivity: false,
          starCount: 0,
          communitySize: "unknown",
          responseTime: "unknown",
        },
      };
      const diff = difficultyMap.get(issue.id) || {
        difficulty: "unknown" as DifficultyLevel,
        reason: "",
        usedAI: false,
      };

      const enrichment: EnrichmentResult = {
        issueId: issue.id,
        healthScore: health.score,
        healthDetails: health.details,
        difficulty: diff.difficulty as DifficultyLevel,
        difficultyReason: diff.reason,
        difficultyUsedAI: diff.usedAI,
      };

      enrichments.push(enrichment);

      // Cache write (fire and forget)
      const [owner, name] = issue.repoFullName.split("/");
      cacheWrites.push(
        CachedIssue.findOneAndUpdate(
          { issueId: issue.id },
          {
            issueId: issue.id,
            data: {},
            healthScore: health.score,
            healthDetails: health.details,
            difficulty: diff.difficulty,
            difficultyReason: diff.reason,
            difficultyUsedAI: diff.usedAI,
            repoOwner: owner,
            repoName: name,
            language: issue.language,
            cachedAt: new Date(),
          },
          { upsert: true }
        ).catch(() => {})
      );
    }

    // Don't await cache writes — return enrichments immediately
    Promise.all(cacheWrites).catch(() => {});

    return NextResponse.json({ enrichments });
  } catch (error) {
    console.error("Error enriching issues:", error);
    return NextResponse.json(
      { error: "Failed to enrich issues" },
      { status: 500 }
    );
  }
}
