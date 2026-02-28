import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import { connectToDatabase } from "@/lib/mongodb";
import { CachedIssue } from "@/models/CachedIssue";
import { IndexedRepo } from "@/models/IndexedRepo";
import type { DifficultyLevel, HealthDetails } from "@/types";

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

interface IssueToEnrich {
  id: string;
  title: string;
  body: string;
  labels: string[];
  repoFullName: string; // "owner/name"
  language: string;
  // Optional repo metadata for IndexedRepo storage
  stargazerCount?: number;
  forkCount?: number;
  description?: string;
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

    // === DIFFICULTY: L1 cache (CachedIssue, 24h TTL) ===
    const issueIds = toEnrich.map((i) => i.id);
    const cachedDiffs = await CachedIssue.find({ issueId: { $in: issueIds } });
    const diffCacheMap = new Map(cachedDiffs.map((doc) => [doc.issueId, doc]));

    // === HEALTH: L2 cache (IndexedRepo, permanent, stale-while-revalidate at 48h) ===
    const uniqueRepoNames = [...new Set(toEnrich.map((i) => i.repoFullName))];
    const indexedRepoDocs = await IndexedRepo.find({ fullName: { $in: uniqueRepoNames } });
    const repoIndexMap = new Map(indexedRepoDocs.map((doc) => [doc.fullName, doc]));

    // Categorize repos: fresh, stale, or missing
    const now = Date.now();
    const freshRepoHealth = new Map<string, { score: number; details: HealthDetails }>();
    const staleRepos: string[] = [];
    const missingRepos: string[] = [];

    for (const repoName of uniqueRepoNames) {
      const indexed = repoIndexMap.get(repoName);
      if (!indexed) {
        missingRepos.push(repoName);
      } else {
        // Always use cached data (even if stale)
        freshRepoHealth.set(repoName, {
          score: indexed.healthScore,
          details: indexed.healthDetails as HealthDetails,
        });
        // If stale, also schedule a background refresh
        if (now - indexed.lastEnrichedAt.getTime() > STALE_THRESHOLD_MS) {
          staleRepos.push(repoName);
        }
      }
    }

    // === Fetch health for MISSING repos (blocking — we have no data at all) ===
    if (missingRepos.length > 0) {
      await Promise.all(
        missingRepos.map(async (fullName) => {
          const [owner, name] = fullName.split("/");
          try {
            const result = await calculateHealthScore(owner, name, userToken);
            freshRepoHealth.set(fullName, result);

            // Find any issue with this repo to get metadata
            const sampleIssue = toEnrich.find((i) => i.repoFullName === fullName);

            // Store in IndexedRepo (permanent)
            IndexedRepo.findOneAndUpdate(
              { fullName },
              {
                fullName,
                owner,
                name,
                healthScore: result.score,
                healthDetails: result.details,
                stargazerCount: sampleIssue?.stargazerCount || 0,
                forkCount: sampleIssue?.forkCount || 0,
                primaryLanguage: sampleIssue?.language || "",
                description: sampleIssue?.description || "",
                lastEnrichedAt: new Date(),
              },
              { upsert: true }
            ).catch(() => {});
          } catch {
            freshRepoHealth.set(fullName, {
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
        })
      );
    }

    // === Background refresh for STALE repos (non-blocking — we already have data) ===
    if (staleRepos.length > 0 && userToken) {
      // Fire and forget — don't await
      Promise.all(
        staleRepos.map(async (fullName) => {
          const [owner, name] = fullName.split("/");
          try {
            const result = await calculateHealthScore(owner, name, userToken);
            await IndexedRepo.findOneAndUpdate(
              { fullName },
              {
                healthScore: result.score,
                healthDetails: result.details,
                lastEnrichedAt: new Date(),
              }
            );
          } catch {
            // Stale data stays — non-critical
          }
        })
      ).catch(() => {});
    }

    // === Estimate difficulty for issues NOT in CachedIssue ===
    const uncachedIssueIds = toEnrich.filter((i) => !diffCacheMap.has(i.id));

    const difficultyResults = await Promise.all(
      uncachedIssueIds.map(async (issue) => {
        const result = await estimateDifficulty(
          issue.title,
          issue.body || "",
          issue.labels
        );
        return { issueId: issue.id, ...result };
      })
    );
    const freshDiffMap = new Map(
      difficultyResults.map((d) => [d.issueId, d])
    );

    // === Cache new difficulty results (fire and forget) ===
    for (const issue of uncachedIssueIds) {
      const diff = freshDiffMap.get(issue.id);
      if (diff) {
        CachedIssue.findOneAndUpdate(
          { issueId: issue.id },
          {
            issueId: issue.id,
            difficulty: diff.difficulty,
            difficultyReason: diff.reason,
            difficultyUsedAI: diff.usedAI,
            repoFullName: issue.repoFullName,
            language: issue.language,
            cachedAt: new Date(),
          },
          { upsert: true }
        ).catch(() => {});
      }
    }

    // === Assemble final enrichments ===
    const enrichments: EnrichmentResult[] = toEnrich.map((issue) => {
      // Health from IndexedRepo (always available after blocking fetch for missing)
      const health = freshRepoHealth.get(issue.repoFullName) || {
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

      // Difficulty from CachedIssue (L1) or fresh computation
      const cachedDiff = diffCacheMap.get(issue.id);
      const freshDiff = freshDiffMap.get(issue.id);
      const diff = cachedDiff
        ? {
            difficulty: cachedDiff.difficulty as DifficultyLevel,
            reason: cachedDiff.difficultyReason,
            usedAI: cachedDiff.difficultyUsedAI || false,
          }
        : freshDiff
        ? {
            difficulty: freshDiff.difficulty as DifficultyLevel,
            reason: freshDiff.reason,
            usedAI: freshDiff.usedAI,
          }
        : { difficulty: "unknown" as DifficultyLevel, reason: "", usedAI: false };

      return {
        issueId: issue.id,
        healthScore: health.score,
        healthDetails: health.details,
        difficulty: diff.difficulty,
        difficultyReason: diff.reason,
        difficultyUsedAI: diff.usedAI,
      };
    });

    return NextResponse.json({ enrichments });
  } catch (error) {
    console.error("Error enriching issues:", error);
    return NextResponse.json(
      { error: "Failed to enrich issues" },
      { status: 500 }
    );
  }
}
