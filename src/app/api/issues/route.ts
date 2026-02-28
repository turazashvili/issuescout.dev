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
      parseInt(searchParams.get("limit") || "60"),
      100
    );
    const labels = searchParams.get("labels")?.split(",").filter(Boolean) || [];
    const showClaimed = searchParams.get("showClaimed") === "true";

    // Get user session for their token
    const session = await auth();
    const userToken = session?.accessToken;

    const hasDifficultyFilter = difficulty !== "all";
    // "easy" has a good comment-count proxy (comments:0..5) so hit rate is high.
    // "medium" and "hard" have no proxy — we need to over-fetch more aggressively.
    const hasGoodProxy = difficulty === "easy";

    // When difficulty filter is active, we over-fetch from GitHub and filter post-enrichment,
    // because difficulty is computed by our AI/rule-based estimator (GitHub doesn't know about it).
    const maxRounds = !hasDifficultyFilter ? 1 : hasGoodProxy ? 3 : 5;
    const fetchSize = hasDifficultyFilter ? Math.max(60, desiredCount) : desiredCount;

    let allFetchedIssues: GitHubIssue[] = [];
    let currentCursor = after;
    let lastPageInfo = { hasNextPage: false, endCursor: null as string | null };
    let githubTotalCount = 0;

    for (let round = 0; round < maxRounds; round++) {
      const { issues: batch, totalCount: tc, pageInfo } = await searchIssues(
        query,
        language,
        fetchSize,
        currentCursor,
        userToken,
        {
          sort,
          labels,
          difficulty,
          showAssigned: showClaimed,
          showLinkedPR: showClaimed,
        }
      );

      githubTotalCount = tc;
      lastPageInfo = pageInfo;
      allFetchedIssues.push(...batch);

      // Stop if we have enough candidates or no more pages
      if (allFetchedIssues.length >= desiredCount * 3 || !pageInfo.hasNextPage) break;
      currentCursor = pageInfo.endCursor;
    }

    // Enrich more candidates when difficulty filtering to ensure enough survive post-filter.
    // easy (with proxy): ~80% hit rate, 3x is plenty
    // medium/hard (no proxy): ~20-40% hit rate, need 5x candidates
    const enrichLimit = !hasDifficultyFilter ? desiredCount : hasGoodProxy ? desiredCount * 3 : desiredCount * 5;
    const issuesToEnrich = allFetchedIssues.slice(0, enrichLimit);

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

    // Trim to desired page size
    const pagedResults = filtered.slice(0, desiredCount);

    return NextResponse.json({
      issues: pagedResults,
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
