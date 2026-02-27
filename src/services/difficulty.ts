import OpenAI from "openai";
import type { DifficultyLevel } from "@/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DifficultyResult {
  difficulty: DifficultyLevel;
  reason: string;
  usedAI: boolean;
}

export async function estimateDifficulty(
  title: string,
  body: string,
  labels: string[]
): Promise<DifficultyResult> {
  // First try rule-based estimation for speed
  const ruleBased = ruleBasedEstimation(title, body, labels);
  if (ruleBased.confidence > 0.8) {
    return { difficulty: ruleBased.difficulty, reason: ruleBased.reason, usedAI: false };
  }

  // Fall back to AI estimation
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "sk-your-openai-api-key") {
      return { difficulty: ruleBased.difficulty, reason: ruleBased.reason, usedAI: false };
    }

    const truncatedBody = body?.slice(0, 1500) || "No description provided";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at evaluating open source issue difficulty for newcomers. 
Classify the issue as "easy", "medium", or "hard" based on:
- Easy: typo fixes, docs updates, simple config changes, adding tests for existing code, small UI tweaks
- Medium: adding small features, refactoring code, fixing non-critical bugs, adding new components
- Hard: architecture changes, complex algorithms, security fixes, performance optimization, cross-cutting concerns

Respond with JSON only: {"difficulty": "easy"|"medium"|"hard", "reason": "brief 10-word reason"}`,
        },
        {
          role: "user",
          content: `Title: ${title}\nLabels: ${labels.join(", ")}\nDescription: ${truncatedBody}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as { difficulty: DifficultyLevel; reason: string };
      if (["easy", "medium", "hard"].includes(parsed.difficulty)) {
        return { ...parsed, usedAI: true };
      }
    }
  } catch (error) {
    console.error("AI difficulty estimation failed:", error);
  }

  return { difficulty: ruleBased.difficulty, reason: ruleBased.reason, usedAI: false };
}

function ruleBasedEstimation(
  title: string,
  body: string,
  labels: string[]
): { difficulty: DifficultyLevel; reason: string; confidence: number } {
  const text = `${title} ${body} ${labels.join(" ")}`.toLowerCase();

  // Easy signals
  const easySignals = [
    "typo",
    "documentation",
    "docs",
    "readme",
    "spelling",
    "grammar",
    "first-timers-only",
    "first timers only",
    "good-first-issue",
    "beginner",
    "easy",
    "simple",
    "trivial",
    "update link",
    "add comment",
    "rename",
    "translation",
    "i18n",
    "l10n",
  ];

  const mediumSignals = [
    "feature",
    "enhancement",
    "refactor",
    "component",
    "test",
    "testing",
    "bug",
    "fix",
    "improve",
    "add support",
    "implement",
    "new",
    "create",
  ];

  const hardSignals = [
    "architecture",
    "security",
    "vulnerability",
    "performance",
    "optimization",
    "breaking change",
    "migration",
    "database",
    "api redesign",
    "complex",
    "critical",
    "regression",
  ];

  let easyScore = 0;
  let mediumScore = 0;
  let hardScore = 0;

  easySignals.forEach((s) => {
    if (text.includes(s)) easyScore++;
  });
  mediumSignals.forEach((s) => {
    if (text.includes(s)) mediumScore++;
  });
  hardSignals.forEach((s) => {
    if (text.includes(s)) hardScore++;
  });

  // Body length as a signal - longer issues tend to be harder
  const bodyLength = body?.length || 0;
  if (bodyLength > 2000) hardScore += 1;
  else if (bodyLength < 300) easyScore += 1;

  // Label-specific overrides
  const labelNames = labels.map((l) => l.toLowerCase());
  if (
    labelNames.some((l) =>
      ["first-timers-only", "good first issue", "beginner"].includes(l)
    )
  ) {
    easyScore += 3;
  }

  const maxScore = Math.max(easyScore, mediumScore, hardScore);
  const totalSignals = easyScore + mediumScore + hardScore;
  const confidence = totalSignals > 0 ? maxScore / totalSignals : 0;

  if (easyScore >= mediumScore && easyScore >= hardScore) {
    return {
      difficulty: "easy",
      reason: "Labels and description suggest a straightforward task",
      confidence,
    };
  } else if (hardScore >= mediumScore) {
    return {
      difficulty: "hard",
      reason: "Issue involves complex changes or architecture",
      confidence,
    };
  } else {
    return {
      difficulty: "medium",
      reason: "Moderate complexity - likely involves adding or modifying features",
      confidence,
    };
  }
}
