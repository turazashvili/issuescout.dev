import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchIssues } from "@/services/github";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import { connectToDatabase } from "@/lib/mongodb";
import { CachedIssue } from "@/models/CachedIssue";
import { Bookmark } from "@/models/Bookmark";
import { SearchLog } from "@/models/SearchLog";
import type { GitHubIssue, EnrichedIssue, DifficultyLevel } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const language = searchParams.get("language") || "";
    const difficulty = (searchParams.get("difficulty") || "all") as
      | DifficultyLevel
      | "all";
    const sort = searchParams.get("sort") || "newest";
    const after = searchParams.get("after") || null;
    const desiredCount = Math.min(
      parseInt(searchParams.get("limit") || "20"),
      30
    );
    const minStars = parseInt(searchParams.get("minStars") || "0");
    const minForks = parseInt(searchParams.get("minForks") || "0");
    const hasStarForkFilter = minStars > 0 || minForks > 0;

    // Get user session for their token
    const session = await auth();
    const userToken = session?.accessToken;

    // When star/fork filters are active, we need to over-fetch from GitHub
    // because we filter post-fetch (GitHub issue search doesn't support stars:/forks:).
    // We fetch in batches until we have enough matching results or run out of pages.
    let allMatchingIssues: GitHubIssue[] = [];
    let currentCursor = after;
    let lastPageInfo = { hasNextPage: false, endCursor: null as string | null };
    let githubTotalCount = 0;
    const maxRounds = hasStarForkFilter ? 5 : 1; // Up to 5 rounds of fetching when filtering
    const fetchSize = hasStarForkFilter ? 30 : desiredCount; // Fetch more per round when filtering

    for (let round = 0; round < maxRounds; round++) {
      const { issues: batch, totalCount: tc, pageInfo } = await searchIssues(
        query,
        language,
        fetchSize,
        currentCursor,
        userToken,
        { sort }
      );

      githubTotalCount = tc;
      lastPageInfo = pageInfo;

      if (hasStarForkFilter) {
        // Pre-filter by stars/forks BEFORE expensive enrichment
        const matching = batch.filter((issue) => {
          if (minStars > 0 && issue.repository.stargazerCount < minStars) return false;
          if (minForks > 0 && issue.repository.forkCount < minForks) return false;
          return true;
        });
        allMatchingIssues.push(...matching);
      } else {
        allMatchingIssues = batch;
      }

      // Stop if we have enough results or no more pages
      if (allMatchingIssues.length >= desiredCount || !pageInfo.hasNextPage) break;
      currentCursor = pageInfo.endCursor;
    }

    // Trim to desired count
    const issuesToEnrich = allMatchingIssues.slice(0, desiredCount);

    // Connect to MongoDB for caching
    await connectToDatabase();

    // Log this search
    try {
      const logEntry = {
        userId: session?.user?.githubId || null,
        userLogin: session?.user?.login || null,
        query,
        programmingLanguage: language,
        difficulty,
        sort,
        resultCount: githubTotalCount,
        timestamp: new Date(),
      };
      console.log("[SearchLog] Writing:", JSON.stringify({ query, programmingLanguage: language, sort, resultCount: githubTotalCount }));
      await SearchLog.create(logEntry);
      console.log("[SearchLog] Written successfully");
    } catch (logError) {
      console.error("[SearchLog] Write failed:", logError);
    }

    // Get user bookmarks if authenticated
    let bookmarkedIds: Set<string> = new Set();
    if (session?.user?.githubId) {
      const userBookmarks = await Bookmark.find(
        { userId: session.user.githubId },
        { issueId: 1 }
      );
      bookmarkedIds = new Set(userBookmarks.map((b) => b.issueId));
    }

    // Enrich issues with health scores and difficulty
    const enrichedIssues: EnrichedIssue[] = await Promise.all(
      issuesToEnrich.map(async (issue) => {
        // Check cache first
        const cached = await CachedIssue.findOne({ issueId: issue.id });
        if (cached) {
          return {
            ...issue,
            healthScore: cached.healthScore,
            healthDetails: cached.healthDetails,
            difficulty: cached.difficulty as DifficultyLevel,
            difficultyReason: cached.difficultyReason,
            difficultyUsedAI: cached.difficultyUsedAI || false,
            isBookmarked: bookmarkedIds.has(issue.id),
          };
        }

        // Calculate health score
        const [owner, name] = issue.repository.nameWithOwner.split("/");
        const { score, details } = await calculateHealthScore(
          owner,
          name,
          userToken
        );

        // Estimate difficulty
        const { difficulty: diffLevel, reason, usedAI } = await estimateDifficulty(
          issue.title,
          issue.body || "",
          issue.labels.map((l) => l.name)
        );

        // Cache the result
        try {
          await CachedIssue.findOneAndUpdate(
            { issueId: issue.id },
            {
              issueId: issue.id,
              data: issue,
              healthScore: score,
              healthDetails: details,
              difficulty: diffLevel,
              difficultyReason: reason,
              difficultyUsedAI: usedAI,
              repoOwner: owner,
              repoName: name,
              language: issue.repository.primaryLanguage?.name || "",
              cachedAt: new Date(),
            },
            { upsert: true }
          );
        } catch {
          // Cache write failure is non-critical
        }

        return {
          ...issue,
          healthScore: score,
          healthDetails: details,
          difficulty: diffLevel,
          difficultyReason: reason,
          difficultyUsedAI: usedAI,
          isBookmarked: bookmarkedIds.has(issue.id),
        };
      })
    );

    // Filter by difficulty if specified (post-enrichment since difficulty is computed)
    let filtered = enrichedIssues;
    if (difficulty !== "all") {
      filtered = enrichedIssues.filter((i) => i.difficulty === difficulty);
    }

    return NextResponse.json({
      issues: filtered,
      totalCount: githubTotalCount,
      pagination: {
        hasNextPage: lastPageInfo.hasNextPage,
        endCursor: lastPageInfo.endCursor,
        totalCount: githubTotalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching issues:", error);
    return NextResponse.json(
      { error: "Failed to fetch issues" },
      { status: 500 }
    );
  }
}
