import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { CachedIssue } from "@/models/CachedIssue";
import { IndexedRepo } from "@/models/IndexedRepo";
import { fetchUserProfile, searchIssues } from "@/services/github";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import type { EnrichedIssue, DifficultyLevel, HealthDetails, GitHubIssue } from "@/types";

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

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

    // Search for issues matching user's top languages (parallel)
    const searchLanguages = topLanguages.slice(0, 3);
    const searchResults = await Promise.all(
      searchLanguages.map(async (lang) => {
        const { issues } = await searchIssues(
          "",
          lang,
          30,
          null,
          session.accessToken
        );
        return issues.map((issue) => ({ issue, lang }));
      })
    );
    const allRawIssues = searchResults.flat();

    // === DIFFICULTY: L1 cache (CachedIssue, 24h TTL) ===
    const issueIds = allRawIssues.map((r) => r.issue.id);
    const cachedDiffs = await CachedIssue.find({ issueId: { $in: issueIds } });
    const diffCacheMap = new Map(cachedDiffs.map((doc) => [doc.issueId, doc]));

    // === HEALTH: L2 cache (IndexedRepo, permanent, stale-while-revalidate) ===
    const uniqueRepoNames = [...new Set(allRawIssues.map((r) => r.issue.repository.nameWithOwner))];
    const indexedRepoDocs = await IndexedRepo.find({ fullName: { $in: uniqueRepoNames } });
    const repoIndexMap = new Map(indexedRepoDocs.map((doc) => [doc.fullName, doc]));

    const now = Date.now();
    const repoHealthMap = new Map<string, { score: number; details: HealthDetails }>();
    const staleRepos: string[] = [];
    const missingRepos: string[] = [];

    for (const repoName of uniqueRepoNames) {
      const indexed = repoIndexMap.get(repoName);
      if (!indexed) {
        missingRepos.push(repoName);
      } else {
        repoHealthMap.set(repoName, {
          score: indexed.healthScore,
          details: indexed.healthDetails as HealthDetails,
        });
        if (now - indexed.lastEnrichedAt.getTime() > STALE_THRESHOLD_MS) {
          staleRepos.push(repoName);
        }
      }
    }

    // Fetch health for MISSING repos (blocking)
    if (missingRepos.length > 0) {
      await Promise.all(
        missingRepos.map(async (fullName) => {
          const [owner, name] = fullName.split("/");
          try {
            const result = await calculateHealthScore(owner, name, session.accessToken);
            repoHealthMap.set(fullName, result);

            const sampleIssue = allRawIssues.find((r) => r.issue.repository.nameWithOwner === fullName)?.issue;
            IndexedRepo.findOneAndUpdate(
              { fullName },
              {
                fullName,
                owner,
                name,
                healthScore: result.score,
                healthDetails: result.details,
                stargazerCount: sampleIssue?.repository.stargazerCount || 0,
                forkCount: sampleIssue?.repository.forkCount || 0,
                primaryLanguage: sampleIssue?.repository.primaryLanguage?.name || "",
                description: sampleIssue?.repository.description || "",
                lastEnrichedAt: new Date(),
              },
              { upsert: true }
            ).catch(() => {});
          } catch {
            repoHealthMap.set(fullName, {
              score: 0,
              details: { score: 0, hasContributing: false, hasLicense: false, recentActivity: false, starCount: 0, communitySize: "unknown", responseTime: "unknown" },
            });
          }
        })
      );
    }

    // Background refresh stale repos (fire and forget)
    if (staleRepos.length > 0) {
      Promise.all(
        staleRepos.map(async (fullName) => {
          const [owner, name] = fullName.split("/");
          try {
            const result = await calculateHealthScore(owner, name, session.accessToken);
            await IndexedRepo.findOneAndUpdate(
              { fullName },
              { healthScore: result.score, healthDetails: result.details, lastEnrichedAt: new Date() }
            );
          } catch {}
        })
      ).catch(() => {});
    }

    // === Estimate difficulty for uncached issues (parallel) ===
    const uncachedIssues = allRawIssues.filter((r) => !diffCacheMap.has(r.issue.id));
    const difficultyResults = await Promise.all(
      uncachedIssues.map(async ({ issue }) => {
        const result = await estimateDifficulty(
          issue.title,
          issue.body || "",
          issue.labels.map((l) => l.name)
        );
        return { issueId: issue.id, ...result };
      })
    );
    const freshDiffMap = new Map(difficultyResults.map((d) => [d.issueId, d]));

    // Cache new difficulty results (fire and forget)
    for (const { issue } of uncachedIssues) {
      const diff = freshDiffMap.get(issue.id);
      if (diff) {
        CachedIssue.findOneAndUpdate(
          { issueId: issue.id },
          {
            issueId: issue.id,
            difficulty: diff.difficulty,
            difficultyReason: diff.reason,
            difficultyUsedAI: diff.usedAI,
            repoFullName: issue.repository.nameWithOwner,
            language: issue.repository.primaryLanguage?.name || "",
            cachedAt: new Date(),
          },
          { upsert: true }
        ).catch(() => {});
      }
    }

    // === Build enriched issues with match scores ===
    const allIssues: EnrichedIssue[] = allRawIssues.map(({ issue, lang }) => {
      const health = repoHealthMap.get(issue.repository.nameWithOwner) || {
        score: 0,
        details: { score: 0, hasContributing: false, hasLicense: false, recentActivity: false, starCount: 0, communitySize: "unknown", responseTime: "unknown" },
      };

      const cachedDiff = diffCacheMap.get(issue.id);
      const freshDiff = freshDiffMap.get(issue.id);
      const diff = cachedDiff
        ? { difficulty: cachedDiff.difficulty as DifficultyLevel, reason: cachedDiff.difficultyReason, usedAI: cachedDiff.difficultyUsedAI || false }
        : freshDiff
        ? { difficulty: freshDiff.difficulty as DifficultyLevel, reason: freshDiff.reason, usedAI: freshDiff.usedAI }
        : { difficulty: "unknown" as DifficultyLevel, reason: "", usedAI: false };

      // Match score (0-100)
      const langIndex = searchLanguages.indexOf(lang);
      const langScore = langIndex === 0 ? 50 : langIndex === 1 ? 35 : 20;
      const healthContribution = Math.round(health.score * 0.3);
      const difficultyBonus = diff.difficulty === "easy" ? 10 : diff.difficulty === "medium" ? 5 : 0;
      let matchScore = langScore + healthContribution + difficultyBonus;

      if (allTopics.length > 0 && issue.repository.description) {
        const desc = issue.repository.description.toLowerCase();
        if (allTopics.some((fw) => desc.includes(fw.toLowerCase()))) {
          matchScore += 10;
        }
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

    // Sort by match score, deduplicate
    allIssues.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
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
