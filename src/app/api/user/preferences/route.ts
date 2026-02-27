import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

// GET: Fetch current user preferences
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const user = await User.findOne({ githubId: session.user.githubId });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      onboardingCompleted: user.onboardingCompleted,
      detectedLanguages: user.languages,
      detectedTopics: user.topics,
      preferredLanguages: user.preferredLanguages,
      preferredFrameworks: user.preferredFrameworks,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// PUT: Update user preferences (post-onboarding edits)
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { languages, frameworks } = await request.json();

    await connectToDatabase();

    await User.findOneAndUpdate(
      { githubId: session.user.githubId },
      {
        ...(languages && { preferredLanguages: languages }),
        ...(frameworks && { preferredFrameworks: frameworks }),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
