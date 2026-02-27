import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { issueId, action } = await request.json();
    if (!issueId || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await connectToDatabase();

    if (action === "add") {
      await User.findOneAndUpdate(
        { githubId: session.user.githubId },
        { $addToSet: { bookmarkedIssues: issueId } }
      );
    } else {
      await User.findOneAndUpdate(
        { githubId: session.user.githubId },
        { $pull: { bookmarkedIssues: issueId } }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error toggling bookmark:", error);
    return NextResponse.json(
      { error: "Failed to update bookmark" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findOne({ githubId: session.user.githubId });

    return NextResponse.json({
      bookmarks: user?.bookmarkedIssues || [],
    });
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookmarks" },
      { status: 500 }
    );
  }
}
