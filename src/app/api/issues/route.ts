import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchIssues } from "@/services/github";
import { connectToDatabase } from "@/lib/mongodb";
import { Bookmark } from "@/models/Bookmark";
import { SearchLog } from "@/models/SearchLog";
import type { DifficultyLevel } from "@/types";

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

    // Fetch issues from GitHub (fast — single GraphQL call)
    const { issues, totalCount, pageInfo } = await searchIssues(
      query,
      language,
      desiredCount,
      after,
      userToken,
      {
        sort,
        labels,
        difficulty,
        showAssigned: showClaimed,
        showLinkedPR: showClaimed,
      }
    );

    // Connect to MongoDB for logging + bookmarks (non-blocking for the response)
    await connectToDatabase();

    // Log this search (fire and forget)
    SearchLog.create({
      userId: session?.user?.githubId || null,
      userLogin: session?.user?.login || null,
      query,
      programmingLanguage: language,
      difficulty,
      sort,
      resultCount: totalCount,
      timestamp: new Date(),
    }).catch((err: unknown) => console.error("[SearchLog] Write failed:", err));

    // Get user bookmarks if authenticated
    let bookmarkedIds: Set<string> = new Set();
    if (session?.user?.githubId) {
      const userBookmarks = await Bookmark.find(
        { userId: session.user.githubId },
        { issueId: 1 }
      );
      bookmarkedIds = new Set(userBookmarks.map((b) => b.issueId));
    }

    // Return issues immediately — no enrichment, just bookmark status
    const issuesWithBookmarks = issues.map((issue) => ({
      ...issue,
      isBookmarked: bookmarkedIds.has(issue.id),
    }));

    return NextResponse.json({
      issues: issuesWithBookmarks,
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
