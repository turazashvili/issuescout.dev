import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchUserProfile } from "@/services/github";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

// GET: Fetch GitHub profile data for onboarding
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

    // Check if user already completed onboarding
    const existingUser = await User.findOne({
      githubId: session.user.githubId,
    });
    if (existingUser?.onboardingCompleted) {
      return NextResponse.json({
        onboardingCompleted: true,
        preferences: {
          languages: existingUser.preferredLanguages,
          frameworks: existingUser.preferredFrameworks,
        },
        detected: {
          languages: existingUser.languages,
          topics: existingUser.topics,
        },
      });
    }

    // Fetch fresh profile data from GitHub
    const profile = await fetchUserProfile(
      session.user.login,
      session.accessToken
    );

    // Save detected languages/topics to user record
    await User.findOneAndUpdate(
      { githubId: session.user.githubId },
      {
        languages: profile.languages,
        topics: profile.topics,
      }
    );

    return NextResponse.json({
      onboardingCompleted: false,
      detected: {
        languages: profile.languages,
        topics: profile.topics,
      },
      preferences: {
        languages: existingUser?.preferredLanguages || [],
        frameworks: existingUser?.preferredFrameworks || [],
      },
    });
  } catch (error) {
    console.error("Error in onboarding GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile data" },
      { status: 500 }
    );
  }
}

// POST: Save onboarding preferences
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.githubId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { languages, frameworks } = await request.json();

    if (!Array.isArray(languages) || !Array.isArray(frameworks)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    await User.findOneAndUpdate(
      { githubId: session.user.githubId },
      {
        preferredLanguages: languages,
        preferredFrameworks: frameworks,
        onboardingCompleted: true,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in onboarding POST:", error);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
