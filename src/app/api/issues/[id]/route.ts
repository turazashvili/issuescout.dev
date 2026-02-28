import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { IndexedRepo } from "@/models/IndexedRepo";
import { calculateHealthScore } from "@/services/healthScore";
import { estimateDifficulty } from "@/services/difficulty";
import { graphql } from "@octokit/graphql";

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

const ISSUE_QUERY = `
  query GetIssue($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $number) {
        id
        number
        title
        body
        bodyHTML
        url
        createdAt
        updatedAt
        state
        labels(first: 20) {
          nodes {
            name
            color
          }
        }
        author {
          login
          avatarUrl
        }
        comments {
          totalCount
        }
        participants(first: 10) {
          totalCount
          nodes {
            login
            avatarUrl
          }
        }
        reactions {
          totalCount
        }
        timelineItems(first: 10, itemTypes: [CROSS_REFERENCED_EVENT]) {
          totalCount
        }
      }
      nameWithOwner
      name
      owner {
        login
        avatarUrl
      }
      description
      url
      stargazerCount
      forkCount
      primaryLanguage {
        name
        color
      }
      licenseInfo {
        name
      }
      updatedAt
      issues(states: OPEN) {
        totalCount
      }
    }
  }
`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parts = id.split("__");
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: "Invalid issue ID format. Use owner__repo__number" },
        { status: 400 }
      );
    }

    const [owner, name, numberStr] = parts;
    const number = parseInt(numberStr);

    const session = await auth();
    const token = session?.accessToken || process.env.GITHUB_PAT || "";

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const gql = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });

    const result = await gql(ISSUE_QUERY, { owner, name, number }) as {
      repository: {
        issue: Record<string, unknown>;
        nameWithOwner: string;
        name: string;
        owner: { login: string; avatarUrl: string };
        description: string | null;
        url: string;
        stargazerCount: number;
        forkCount: number;
        primaryLanguage: { name: string; color: string } | null;
        licenseInfo: { name: string } | null;
        updatedAt: string;
        issues: { totalCount: number };
      };
    };

    await connectToDatabase();

    const fullName = `${owner}/${name}`;

    // Check IndexedRepo for health score
    let score: number;
    let details;
    const indexed = await IndexedRepo.findOne({ fullName });

    if (indexed && (Date.now() - indexed.lastEnrichedAt.getTime() < STALE_THRESHOLD_MS)) {
      // Fresh — use cached
      score = indexed.healthScore;
      details = indexed.healthDetails;
    } else {
      // Missing or stale — compute fresh
      const healthResult = await calculateHealthScore(owner, name, token);
      score = healthResult.score;
      details = healthResult.details;

      // Store/update in IndexedRepo
      IndexedRepo.findOneAndUpdate(
        { fullName },
        {
          fullName,
          owner,
          name,
          healthScore: score,
          healthDetails: details,
          stargazerCount: result.repository.stargazerCount,
          forkCount: result.repository.forkCount,
          primaryLanguage: result.repository.primaryLanguage?.name || "",
          description: result.repository.description || "",
          lastEnrichedAt: new Date(),
        },
        { upsert: true }
      ).catch(() => {});
    }

    // Estimate difficulty
    const issue = result.repository.issue;
    const { difficulty, reason } = await estimateDifficulty(
      issue.title as string,
      (issue.body as string) || "",
      ((issue.labels as { nodes: { name: string }[] })?.nodes || []).map(
        (l: { name: string }) => l.name
      )
    );

    return NextResponse.json({
      issue: {
        ...issue,
        labels: (issue.labels as { nodes: unknown[] })?.nodes || [],
        repository: {
          nameWithOwner: result.repository.nameWithOwner,
          name: result.repository.name,
          owner: result.repository.owner,
          description: result.repository.description,
          url: result.repository.url,
          stargazerCount: result.repository.stargazerCount,
          forkCount: result.repository.forkCount,
          primaryLanguage: result.repository.primaryLanguage,
          licenseInfo: result.repository.licenseInfo,
          updatedAt: result.repository.updatedAt,
          issues: result.repository.issues,
        },
      },
      healthScore: score,
      healthDetails: details,
      difficulty,
      difficultyReason: reason,
    });
  } catch (error) {
    console.error("Error fetching issue:", error);
    return NextResponse.json(
      { error: "Failed to fetch issue details" },
      { status: 500 }
    );
  }
}
