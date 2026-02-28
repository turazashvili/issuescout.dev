import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { fetchUserProfile, searchIssues } from "@/services/github";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import type { EnrichedIssue, DifficultyLevel } from "@/types";

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
    const allIssues: EnrichedIssue[] = [];

    for (const lang of searchLanguages) {
      const { issues } = await searchIssues(
        "",
        lang,
        30,
        null,
        session.accessToken
      );

      const enriched = await Promise.all(
        issues.map(async (issue) => {
          const [owner, name] = issue.repository.nameWithOwner.split("/");
          const { score, details } = await calculateHealthScore(
            owner,
            name,
            session.accessToken
          );
          const { difficulty, reason, usedAI } = await estimateDifficulty(
            issue.title,
            issue.body || "",
            issue.labels.map((l) => l.name)
          );

          // Calculate match score (0-100)
          // Base: language rank contributes up to 50 points
          const langIndex = searchLanguages.indexOf(lang);
          const langScore = langIndex === 0 ? 50 : langIndex === 1 ? 35 : 20;

          // Health score contributes up to 30 points
          const healthContribution = Math.round(score * 0.3);

          // Difficulty: easy issues are better matches for discovery
          const difficultyBonus = difficulty === "easy" ? 10 : difficulty === "medium" ? 5 : 0;

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
            healthScore: score,
            healthDetails: details,
            difficulty: difficulty as DifficultyLevel,
            difficultyReason: reason,
            difficultyUsedAI: usedAI,
            matchScore: Math.min(matchScore, 100),
          };
        })
      );

      allIssues.push(...enriched);
    }

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
