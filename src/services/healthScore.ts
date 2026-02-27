import type { HealthDetails } from "@/types";
import { fetchRepoHealth } from "./github";

export async function calculateHealthScore(
  owner: string,
  name: string,
  userToken?: string
): Promise<{ score: number; details: HealthDetails }> {
  try {
    const repo = await fetchRepoHealth(owner, name, userToken);
    let score = 0;

    // 1. Has CONTRIBUTING.md (15 points)
    const hasContributing = !!(
      repo.hasContributing || repo.hasContributingLower
    );
    if (hasContributing) score += 15;

    // 2. Has license (10 points)
    const hasLicense = !!repo.licenseInfo;
    if (hasLicense) score += 10;

    // 3. Has code of conduct (5 points)
    if (repo.codeOfConduct) score += 5;

    // 4. Recent activity - last commit within 30 days (20 points)
    let recentActivity = false;
    if (repo.defaultBranchRef?.target?.history?.nodes?.[0]) {
      const lastCommit = new Date(
        repo.defaultBranchRef.target.history.nodes[0].committedDate
      );
      const daysSinceLastCommit =
        (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastCommit < 30) {
        score += 20;
        recentActivity = true;
      } else if (daysSinceLastCommit < 90) {
        score += 10;
        recentActivity = true;
      }
    }

    // 5. Star count - popularity signal (15 points max)
    const stars = repo.stargazerCount || 0;
    if (stars >= 1000) score += 15;
    else if (stars >= 100) score += 12;
    else if (stars >= 10) score += 8;
    else if (stars >= 1) score += 4;

    // 6. Response time on issues (20 points max)
    let responseTime = "unknown";
    if (repo.issues?.nodes?.length > 0) {
      const responseTimes: number[] = [];
      for (const issue of repo.issues.nodes) {
        if (issue.comments?.nodes?.[0]) {
          const issueCreated = new Date(issue.createdAt).getTime();
          const firstComment = new Date(
            issue.comments.nodes[0].createdAt
          ).getTime();
          responseTimes.push(firstComment - issueCreated);
        }
      }

      if (responseTimes.length > 0) {
        const avgResponseMs =
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const avgResponseHours = avgResponseMs / (1000 * 60 * 60);

        if (avgResponseHours < 24) {
          score += 20;
          responseTime = "< 24 hours";
        } else if (avgResponseHours < 72) {
          score += 15;
          responseTime = "1-3 days";
        } else if (avgResponseHours < 168) {
          score += 10;
          responseTime = "3-7 days";
        } else {
          score += 5;
          responseTime = "> 7 days";
        }
      }
    }

    // 7. PR activity - merged PRs signal active maintenance (15 points)
    const mergedPRs = repo.pullRequests?.totalCount || 0;
    if (mergedPRs >= 100) score += 15;
    else if (mergedPRs >= 50) score += 12;
    else if (mergedPRs >= 10) score += 8;
    else if (mergedPRs >= 1) score += 4;

    // Determine community size label
    let communitySize = "small";
    const forks = repo.forkCount || 0;
    if (stars >= 1000 || forks >= 100) communitySize = "large";
    else if (stars >= 100 || forks >= 20) communitySize = "medium";

    const details: HealthDetails = {
      score: Math.min(score, 100),
      hasContributing,
      hasLicense,
      recentActivity,
      starCount: stars,
      communitySize,
      responseTime,
    };

    return { score: Math.min(score, 100), details };
  } catch (error) {
    console.error(`Error calculating health score for ${owner}/${name}:`, error);
    return {
      score: 0,
      details: {
        score: 0,
        hasContributing: false,
        hasLicense: false,
        recentActivity: false,
        starCount: 0,
        communitySize: "unknown",
        responseTime: "unknown",
      },
    };
  }
}
