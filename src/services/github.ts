import { graphql } from "@octokit/graphql";
import type { GitHubIssue } from "@/types";

const SEARCH_ISSUES_QUERY = `
  query SearchIssues($searchQuery: String!, $first: Int!, $after: String) {
    search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on Issue {
          id
          number
          title
          body
          url
          createdAt
          updatedAt
          state
          labels(first: 10) {
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
          reactions {
            totalCount
          }
          repository {
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
      }
    }
  }
`;

const REPO_HEALTH_QUERY = `
  query RepoHealth($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      nameWithOwner
      stargazerCount
      forkCount
      hasContributing: object(expression: "HEAD:CONTRIBUTING.md") {
        ... on Blob {
          byteSize
        }
      }
      hasContributingLower: object(expression: "HEAD:contributing.md") {
        ... on Blob {
          byteSize
        }
      }
      codeOfConduct {
        name
      }
      licenseInfo {
        name
      }
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 1) {
              nodes {
                committedDate
              }
            }
          }
        }
      }
      issues(states: OPEN, first: 5, orderBy: { field: CREATED_AT, direction: DESC }) {
        totalCount
        nodes {
          createdAt
          comments(first: 1) {
            nodes {
              createdAt
            }
          }
        }
      }
      pullRequests(states: MERGED, first: 10, orderBy: { field: CREATED_AT, direction: DESC }) {
        totalCount
      }
      pullRequestsOpen: pullRequests(states: OPEN) {
        totalCount
      }
    }
  }
`;

const USER_PROFILE_QUERY = `
  query UserProfile($login: String!) {
    user(login: $login) {
      login
      name
      avatarUrl
      repositories(first: 20, orderBy: { field: STARGAZERS, direction: DESC }, ownerAffiliations: OWNER) {
        nodes {
          primaryLanguage {
            name
          }
        }
      }
      starredRepositories(first: 30, orderBy: { field: STARRED_AT, direction: DESC }) {
        nodes {
          primaryLanguage {
            name
          }
          repositoryTopics(first: 5) {
            nodes {
              topic {
                name
              }
            }
          }
        }
      }
    }
  }
`;

function createGraphQLClient(token: string) {
  return graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });
}

function getToken(userToken?: string): string {
  return userToken || process.env.GITHUB_PAT || "";
}

// Default labels applied when user hasn't customized their selection
const DEFAULT_LABELS = ["good first issue", "good-first-issue"];

export async function searchIssues(
  query: string,
  language: string = "",
  first: number = 20,
  after: string | null = null,
  userToken?: string,
  options?: {
    sort?: string;
    labels?: string[];         // User-selected labels (OR logic)
    difficulty?: string;       // For comment-count proxy (easy/medium/hard/all)
    showAssigned?: boolean;    // If true, removes no:assignee qualifier
    showLinkedPR?: boolean;    // If true, removes -linked:pr qualifier
  }
): Promise<{
  issues: GitHubIssue[];
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}> {
  const token = getToken(userToken);
  if (!token) throw new Error("No GitHub token available");

  const gql = createGraphQLClient(token);

  // Build search query

  // 1. Base qualifiers — always applied for quality results
  let searchQuery = `state:open is:issue is:public archived:false`;

  // 2. Availability filters — on by default, toggleable by user
  if (!options?.showAssigned) {
    searchQuery += ` no:assignee`;
  }
  if (!options?.showLinkedPR) {
    searchQuery += ` -linked:pr`;
  }

  // 3. Labels — user-selectable, defaults to good-first-issue variants
  // undefined/null = use defaults (e.g. landing page navigation with no label param)
  // empty array = user explicitly deselected all labels, skip label qualifier entirely
  const labels = options?.labels !== undefined ? options.labels : DEFAULT_LABELS;
  if (labels.length > 0) {
    const labelQuery = labels.map((l) => `"${l}"`).join(",");
    searchQuery += ` label:${labelQuery}`;
  }

  // 4. User text query
  if (query) {
    searchQuery = `${query} ${searchQuery}`;
  }

  // 5. Language filter
  if (language) {
    searchQuery += ` language:${language}`;
  }

  // 6. Difficulty proxy via comment count
  // Low-comment issues correlate with simpler/newer issues (easy),
  // high-comment issues correlate with more complex/discussed issues (hard).
  // This pre-biases GitHub results so post-fetch AI difficulty has a higher hit rate.
  // Note: this is a heuristic proxy — actual difficulty is determined post-fetch by our estimator.
  if (options?.difficulty && options.difficulty !== "all") {
    switch (options.difficulty) {
      case "easy":
        searchQuery += ` comments:0..5`;
        break;
      // "medium" and "hard" — no comment proxy.
      // The "hard" proxy (comments:>5) had poor correlation with actual difficulty;
      // most high-comment issues are just popular, not necessarily hard.
      // We rely on the over-fetch + AI estimator strategy instead.
    }
  }

  // 7. Sort — GitHub issue search supports: sort:created, sort:comments, sort:updated, sort:reactions
  if (options?.sort) {
    switch (options.sort) {
      case "oldest":
        searchQuery += ` sort:created-asc`;
        break;
      case "most-commented":
        searchQuery += ` sort:comments-desc`;
        break;
      case "recently-updated":
        searchQuery += ` sort:updated-desc`;
        break;
      case "most-reactions":
        searchQuery += ` sort:reactions-desc`;
        break;
      // "newest" is GitHub's default (sort:created-desc)
      // "health-score" can't be sorted server-side — handled client-side
    }
  }

  const result: {
    search: {
      issueCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RawIssueNode[];
    };
  } = await gql(SEARCH_ISSUES_QUERY, {
    searchQuery,
    first,
    after,
  });

  const issues: GitHubIssue[] = result.search.nodes
    .filter((node: RawIssueNode) => node && node.id)
    .map((node: RawIssueNode) => ({
      ...node,
      labels: node.labels?.nodes || [],
      repository: {
        ...node.repository,
        hasContributing: false,
      },
    }));

  return {
    issues,
    totalCount: result.search.issueCount,
    pageInfo: result.search.pageInfo,
  };
}

interface RawIssueNode {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: string;
  labels: {
    nodes: { name: string; color: string }[];
  };
  author: {
    login: string;
    avatarUrl: string;
  };
  comments: {
    totalCount: number;
  };
  reactions: {
    totalCount: number;
  };
  repository: {
    nameWithOwner: string;
    name: string;
    owner: {
      login: string;
      avatarUrl: string;
    };
    description: string | null;
    url: string;
    stargazerCount: number;
    forkCount: number;
    primaryLanguage: {
      name: string;
      color: string;
    } | null;
    licenseInfo: {
      name: string;
    } | null;
    updatedAt: string;
    issues: {
      totalCount: number;
    };
  };
}

interface RepoHealthResponse {
  repository: {
    nameWithOwner: string;
    stargazerCount: number;
    forkCount: number;
    hasContributing: { byteSize: number } | null;
    hasContributingLower: { byteSize: number } | null;
    codeOfConduct: { name: string } | null;
    licenseInfo: { name: string } | null;
    defaultBranchRef: {
      target: {
        history: {
          nodes: { committedDate: string }[];
        };
      };
    } | null;
    issues: {
      totalCount: number;
      nodes: {
        createdAt: string;
        comments: {
          nodes: { createdAt: string }[];
        };
      }[];
    };
    pullRequests: { totalCount: number };
    pullRequestsOpen: { totalCount: number };
  };
}

export async function fetchRepoHealth(
  owner: string,
  name: string,
  userToken?: string
): Promise<RepoHealthResponse["repository"]> {
  const token = getToken(userToken);
  if (!token) throw new Error("No GitHub token available");

  const gql = createGraphQLClient(token);
  const result = (await gql(REPO_HEALTH_QUERY, {
    owner,
    name,
  })) as RepoHealthResponse;

  return result.repository;
}

interface UserProfileResponse {
  user: {
    login: string;
    name: string;
    avatarUrl: string;
    repositories: {
      nodes: {
        primaryLanguage: { name: string } | null;
      }[];
    };
    starredRepositories: {
      nodes: {
        primaryLanguage: { name: string } | null;
        repositoryTopics: {
          nodes: {
            topic: { name: string };
          }[];
        };
      }[];
    };
  };
}

export async function fetchUserProfile(
  login: string,
  userToken?: string
): Promise<{ languages: string[]; topics: string[] }> {
  const token = getToken(userToken);
  if (!token) throw new Error("No GitHub token available");

  const gql = createGraphQLClient(token);
  const result = (await gql(USER_PROFILE_QUERY, {
    login,
  })) as UserProfileResponse;

  // Extract languages from user's repos and starred repos
  const langCounts = new Map<string, number>();

  result.user.repositories.nodes.forEach((repo) => {
    if (repo.primaryLanguage?.name) {
      langCounts.set(
        repo.primaryLanguage.name,
        (langCounts.get(repo.primaryLanguage.name) || 0) + 2
      );
    }
  });

  result.user.starredRepositories.nodes.forEach((repo) => {
    if (repo.primaryLanguage?.name) {
      langCounts.set(
        repo.primaryLanguage.name,
        (langCounts.get(repo.primaryLanguage.name) || 0) + 1
      );
    }
  });

  const languages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lang]) => lang);

  // Extract topics from starred repos
  const topicCounts = new Map<string, number>();
  result.user.starredRepositories.nodes.forEach((repo) => {
    repo.repositoryTopics?.nodes?.forEach((t) => {
      topicCounts.set(
        t.topic.name,
        (topicCounts.get(t.topic.name) || 0) + 1
      );
    });
  });

  const topics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic]) => topic);

  return { languages, topics };
}
