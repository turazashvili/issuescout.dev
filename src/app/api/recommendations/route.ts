import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { CachedIssue } from "@/models/CachedIssue";
import { fetchUserProfile, searchIssues } from "@/services/github";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import type { EnrichedIssue, DifficultyLevel, HealthDetails, GitHubIssue } from "@/types";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.login || !session?.accessToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const user = await User.findOne({ githubId: session.user.githubId });

    let topLanguages: string[] = [];
    let allTopics: string[] = [];

    // Use saved preferences if onboarding completed
    if (user?.onboardingCompleted && user.preferredLanguages?.length > 0) {
      topLanguages = user.preferredLanguages.slice(0, 5);
      allTopics = user.preferredFrameworks || [];
    } else {
      // Fallback: fetch from GitHub profile
      const profile = await fetchUserProfile(
        session.user.login,
        session.accessToken
      );
      topLanguages = profile.languages.slice(0, 3);
      allTopics = profile.topics;
    }

    if (topLanguages.length === 0) {
      return NextResponse.json({
        issues: [],
        userLanguages: [],
        userTopics: [],
      });
    }

    // Search for issues matching user's top languages
    const searchLanguages = topLanguages.slice(0, 3);
    const allRawIssues: { issue: GitHubIssue; lang: string }[] = [];

    for (const lang of searchLanguages) {
      const { issues } = await searchIssues(
        "",
        lang,
        30,
        null,
        session.accessToken
      );
      for (const issue of issues) {
        allRawIssues.push({ issue, lang });
      }
    }

    // Check cache for all issues in one query
    const issueIds = allRawIssues.map((r) => r.issue.id);
    const cachedDocs = await CachedIssue.find({ issueId: { $in: issueIds } });
    const cacheMap = new Map(cachedDocs.map((doc) => [doc.issueId, doc]));

    // Separate cached from uncached
    const cachedResults = new Map<string, { healthScore: number; healthDetails: HealthDetails; difficulty: DifficultyLevel; difficultyReason: string; difficultyUsedAI: boolean }>();
    const uncachedRawIssues: { issue: GitHubIssue; lang: string }[] = [];

    for (const entry of allRawIssues) {
      const cached = cacheMap.get(entry.issue.id);
      if (cached) {
        cachedResults.set(entry.issue.id, {
          healthScore: cached.healthScore,
          healthDetails: cached.healthDetails as HealthDetails,
          difficulty: cached.difficulty as DifficultyLevel,
          difficultyReason: cached.difficultyReason,
          difficultyUsedAI: cached.difficultyUsedAI || false,
        });
      } else {
        uncachedRawIssues.push(entry);
      }
    }

    // Deduplicate repos for health score calls
    const uniqueRepos = new Map<string, { owner: string; name: string }>();
    for (const { issue } of uncachedRawIssues) {
      const fullName = issue.repository.nameWithOwner;
      if (!uniqueRepos.has(fullName)) {
        const [owner, name] = fullName.split("/");
        uniqueRepos.set(fullName, { owner, name });
      }
    }

    // Fetch health scores for unique repos in parallel
    const repoHealthMap = new Map<string, { score: number; details: HealthDetails }>();
    await Promise.all(
      Array.from(uniqueRepos.entries()).map(async ([fullName, { owner, name }]) => {
        try {
          const result = await calculateHealthScore(owner, name, session.accessToken);
          repoHealthMap.set(fullName, result);
        } catch {
          repoHealthMap.set(fullName, {
            score: 0,
            details: { score: 0, hasContributing: false, hasLicense: false, recentActivity: false, starCount: 0, communitySize: "unknown", responseTime: "unknown" },
          });
        }
      })
    );

    // Estimate difficulty for all uncached issues in parallel
    const difficultyResults = await Promise.all(
      uncachedRawIssues.map(async ({ issue }) => {
        const result = await estimateDifficulty(
          issue.title,
          issue.body || "",
          issue.labels.map((l) => l.name)
        );
        return { issueId: issue.id, ...result };
      })
    );
    const difficultyMap = new Map(difficultyResults.map((d) => [d.issueId, d]));

    // Cache uncached results (fire and forget)
    for (const { issue } of uncachedRawIssues) {
      const fullName = issue.repository.nameWithOwner;
      const health = repoHealthMap.get(fullName);
      const diff = difficultyMap.get(issue.id);
      if (health && diff) {
        const [owner, name] = fullName.split("/");
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
            language: issue.repository.primaryLanguage?.name || "",
            cachedAt: new Date(),
          },
          { upsert: true }
        ).catch(() => {});
      }
    }

    // Build enriched issues with match scores
    const allIssues: EnrichedIssue[] = allRawIssues.map(({ issue, lang }) => {
      // Get enrichment data (from cache or freshly computed)
      const cached = cachedResults.get(issue.id);
      const health = cached
        ? { score: cached.healthScore, details: cached.healthDetails }
        : repoHealthMap.get(issue.repository.nameWithOwner) || { score: 0, details: { score: 0, hasContributing: false, hasLicense: false, recentActivity: false, starCount: 0, communitySize: "unknown", responseTime: "unknown" } };
      const diff = cached
        ? { difficulty: cached.difficulty, reason: cached.difficultyReason, usedAI: cached.difficultyUsedAI }
        : difficultyMap.get(issue.id) || { difficulty: "unknown" as DifficultyLevel, reason: "", usedAI: false };

      // Calculate match score (0-100)
      const langIndex = searchLanguages.indexOf(lang);
      const langScore = langIndex === 0 ? 50 : langIndex === 1 ? 35 : 20;
      const healthContribution = Math.round(health.score * 0.3);
      const difficultyBonus = diff.difficulty === "easy" ? 10 : diff.difficulty === "medium" ? 5 : 0;

      let matchScore = langScore + healthContribution + difficultyBonus;

      // Boost score if repo description/topics match user's frameworks (+10)
      if (allTopics.length > 0 && issue.repository.description) {
        const desc = issue.repository.description.toLowerCase();
        const frameworkMatch = allTopics.some((fw) =>
          desc.includes(fw.toLowerCase())
        );
        if (frameworkMatch) matchScore += 10;
      }

      return {
        ...issue,
        healthScore: health.score,
        healthDetails: health.details,
        difficulty: diff.difficulty as DifficultyLevel,
        difficultyReason: diff.reason,
        difficultyUsedAI: diff.usedAI,
        matchScore: Math.min(matchScore, 100),
      };
    });

    // Sort by match score
    allIssues.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    // Deduplicate
    const seen = new Set<string>();
    const unique = allIssues.filter((issue) => {
      if (seen.has(issue.id)) return false;
      seen.add(issue.id);
      return true;
    });

    return NextResponse.json({
      issues: unique.slice(0, 60),
      userLanguages: topLanguages,
      userTopics: allTopics,
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
