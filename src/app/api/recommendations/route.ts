import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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

    // Fetch user profile to get their languages and topics
    const profile = await fetchUserProfile(
      session.user.login,
      session.accessToken
    );

    // Search for issues matching user's top languages
    const topLanguages = profile.languages.slice(0, 3);
    const allIssues: EnrichedIssue[] = [];

    for (const lang of topLanguages) {
      const { issues } = await searchIssues(
        "",
        lang,
        10,
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
          const { difficulty, reason } = await estimateDifficulty(
            issue.title,
            issue.body || "",
            issue.labels.map((l) => l.name)
          );

          // Calculate match score based on language match
          const langIndex = topLanguages.indexOf(lang);
          const matchScore = Math.round(
            100 - langIndex * 15 + score * 0.3
          );

          return {
            ...issue,
            healthScore: score,
            healthDetails: details,
            difficulty: difficulty as DifficultyLevel,
            difficultyReason: reason,
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
      issues: unique.slice(0, 15),
      userLanguages: profile.languages,
      userTopics: profile.topics,
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
