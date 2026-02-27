import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchIssues } from "@/services/github";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import { connectToDatabase } from "@/lib/mongodb";
import { CachedIssue } from "@/models/CachedIssue";
import { User } from "@/models/User";
import type { EnrichedIssue, DifficultyLevel } from "@/types";

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
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20"),
      30
    );

    // Get user session for their token
    const session = await auth();
    const userToken = session?.accessToken;

    // Search GitHub
    const { issues, totalCount, pageInfo } = await searchIssues(
      query,
      language,
      limit,
      after,
      userToken
    );

    // Connect to MongoDB for caching
    await connectToDatabase();

    // Get user bookmarks if authenticated
    let bookmarkedIds: Set<string> = new Set();
    if (session?.user?.githubId) {
      const user = await User.findOne({ githubId: session.user.githubId });
      if (user) {
        bookmarkedIds = new Set(user.bookmarkedIssues);
      }
    }

    // Enrich issues with health scores and difficulty
    const enrichedIssues: EnrichedIssue[] = await Promise.all(
      issues.map(async (issue) => {
        // Check cache first
        const cached = await CachedIssue.findOne({ issueId: issue.id });
        if (cached) {
          return {
            ...issue,
            healthScore: cached.healthScore,
            healthDetails: cached.healthDetails,
            difficulty: cached.difficulty as DifficultyLevel,
            difficultyReason: cached.difficultyReason,
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
        const { difficulty: diffLevel, reason } = await estimateDifficulty(
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
          isBookmarked: bookmarkedIds.has(issue.id),
        };
      })
    );

    // Filter by difficulty if specified
    let filtered = enrichedIssues;
    if (difficulty !== "all") {
      filtered = enrichedIssues.filter((i) => i.difficulty === difficulty);
    }

    // Sort
    switch (sort) {
      case "oldest":
        filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case "most-commented":
        filtered.sort(
          (a, b) => b.comments.totalCount - a.comments.totalCount
        );
        break;
      case "health-score":
        filtered.sort((a, b) => b.healthScore - a.healthScore);
        break;
      case "newest":
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return NextResponse.json({
      issues: filtered,
      totalCount,
      pagination: {
        hasNextPage: pageInfo.hasNextPage,
        endCursor: pageInfo.endCursor,
        totalCount,
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
