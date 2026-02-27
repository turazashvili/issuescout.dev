export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: string;
  labels: GitHubLabel[];
  author: {
    login: string;
    avatarUrl: string;
  };
  comments: {
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
    hasContributing: boolean;
    licenseInfo: {
      name: string;
    } | null;
    updatedAt: string;
    issues: {
      totalCount: number;
    };
  };
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface EnrichedIssue extends GitHubIssue {
  healthScore: number;
  healthDetails: HealthDetails;
  difficulty: DifficultyLevel;
  difficultyReason: string;
  matchScore?: number;
  isBookmarked?: boolean;
}

export interface HealthDetails {
  score: number;
  hasContributing: boolean;
  hasLicense: boolean;
  recentActivity: boolean;
  starCount: number;
  communitySize: string;
  responseTime: string;
}

export type DifficultyLevel = "easy" | "medium" | "hard" | "unknown";

export interface SearchFilters {
  query: string;
  language: string;
  difficulty: DifficultyLevel | "all";
  sort: "newest" | "oldest" | "most-commented" | "health-score";
  labels: string[];
}

export interface UserProfile {
  githubId: string;
  login: string;
  name: string;
  avatarUrl: string;
  email: string;
  languages: string[];
  bookmarkedIssues: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationInfo {
  hasNextPage: boolean;
  endCursor: string | null;
  totalCount: number;
}

export interface SearchResult {
  issues: EnrichedIssue[];
  pagination: PaginationInfo;
  totalCount: number;
}
