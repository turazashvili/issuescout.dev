import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Bookmark } from "@/models/Bookmark";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { issueId, action, issueData } = await request.json();
    const userId = session.user.githubId;

    if (!issueId || !["add", "remove", "archive", "unarchive"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await connectToDatabase();

    switch (action) {
      case "add": {
        if (!issueData) {
          return NextResponse.json({ error: "issueData required for add" }, { status: 400 });
        }
        // Upsert: if already exists (e.g. was archived), reactivate with fresh data
        await Bookmark.findOneAndUpdate(
          { userId, issueId },
          {
            userId,
            issueId,
            issueData,
            archived: false,
            savedAt: new Date(),
            archivedAt: null,
          },
          { upsert: true }
        );
        break;
      }
      case "remove": {
        await Bookmark.deleteOne({ userId, issueId });
        break;
      }
      case "archive": {
        await Bookmark.findOneAndUpdate(
          { userId, issueId },
          { archived: true, archivedAt: new Date() }
        );
        break;
      }
      case "unarchive": {
        await Bookmark.findOneAndUpdate(
          { userId, issueId },
          { archived: false, archivedAt: null }
        );
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating bookmark:", error);
    return NextResponse.json(
      { error: "Failed to update bookmark" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const userId = session.user.githubId;

    await connectToDatabase();

    const query: Record<string, unknown> = { userId };
    if (status === "active") {
      query.archived = false;
    } else if (status === "archived") {
      query.archived = true;
    }
    // status === "all" → no archived filter, returns everything

    const bookmarks = await Bookmark.find(query).sort({ savedAt: -1 });

    const issues = bookmarks.map((b) => ({
      ...b.issueData,
      isBookmarked: true,
      isArchived: b.archived,
    }));

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookmarks" },
      { status: 500 }
    );
  }
}
