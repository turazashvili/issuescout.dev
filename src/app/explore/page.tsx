"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { IssueCard } from "@/components/IssueCard";
import { IssueCardSkeleton } from "@/components/IssueCardSkeleton";
import { FilterBar, DEFAULT_LABELS } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EnrichedIssue, DifficultyLevel, GitHubIssue } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sparkles, Search, Loader2, Frown, Settings2, Github } from "lucide-react";

function sortIssues(issues: EnrichedIssue[], sortKey: string) {
  const sorted = [...issues];
  switch (sortKey) {
    case "newest":
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case "oldest":
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case "most-commented":
      sorted.sort((a, b) => b.comments.totalCount - a.comments.totalCount);
      break;
    case "health-score":
      sorted.sort((a, b) => (b.matchScore || b.healthScore || 0) - (a.matchScore || a.healthScore || 0));
      break;
  }
  return sorted;
}

// Helper: call the enrich API and merge results into existing issues
async function enrichIssues(
  issues: GitHubIssue[]
): Promise<Map<string, { healthScore: number; healthDetails: EnrichedIssue["healthDetails"]; difficulty: DifficultyLevel; difficultyReason: string; difficultyUsedAI: boolean }>> {
  const payload = issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    body: issue.body || "",
    labels: issue.labels.map((l) => l.name),
    repoFullName: issue.repository.nameWithOwner,
    language: issue.repository.primaryLanguage?.name || "",
    stargazerCount: issue.repository.stargazerCount,
    forkCount: issue.repository.forkCount,
    description: issue.repository.description || "",
  }));

  const res = await fetch("/api/issues/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issues: payload }),
  });

  const enrichmentMap = new Map<string, { healthScore: number; healthDetails: EnrichedIssue["healthDetails"]; difficulty: DifficultyLevel; difficultyReason: string; difficultyUsedAI: boolean }>();

  if (res.ok) {
    const data = await res.json();
    for (const e of data.enrichments) {
      enrichmentMap.set(e.issueId, {
        healthScore: e.healthScore,
        healthDetails: e.healthDetails,
        difficulty: e.difficulty,
        difficultyReason: e.difficultyReason,
        difficultyUsedAI: e.difficultyUsedAI,
      });
    }
  }

  return enrichmentMap;
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();

  const initialTab = searchParams.get("tab") || "search";
  const initialQuery = searchParams.get("q") || "";
  const initialLanguage = searchParams.get("language") || "";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Search tab state
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const [language, setLanguage] = useState(initialLanguage);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "all">(
    (searchParams.get("difficulty") as DifficultyLevel) || "all"
  );
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [labels, setLabels] = useState<string[]>(() => {
    const urlLabels = searchParams.get("labels");
    return urlLabels ? urlLabels.split(",") : [...DEFAULT_LABELS];
  });
  const [showClaimed, setShowClaimed] = useState(searchParams.get("showClaimed") === "true");
  const [rawIssues, setRawIssues] = useState<EnrichedIssue[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | undefined>();
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  // Recommended tab state
  const [recommendedIssues, setRecommendedIssues] = useState<EnrichedIssue[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [userLanguages, setUserLanguages] = useState<string[]>([]);
  const [userTopics, setUserTopics] = useState<string[]>([]);

  // Recommended tab filters (lightweight client-side only)
  const [recQuery, setRecQuery] = useState("");
  const [recLanguage, setRecLanguage] = useState("");
  const [recDifficulty, setRecDifficulty] = useState<DifficultyLevel | "all">("all");
  const [recVisibleCount, setRecVisibleCount] = useState(20);

  // Use a ref to always get latest endCursor for "Load More" without
  // recreating the fetch function and causing extra renders
  const endCursorRef = useRef(endCursor);
  endCursorRef.current = endCursor;

  // Track the current enrich request so we can ignore stale ones
  const enrichRequestId = useRef(0);

  // Sync filter state -> URL search params
  // Only sync search-tab filters when on the search tab.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "search") {
      params.set("tab", activeTab);
    } else {
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (language) params.set("language", language);
      if (difficulty !== "all") params.set("difficulty", difficulty);
      if (sort !== "newest") params.set("sort", sort);
      const labelsChanged = JSON.stringify([...labels].sort()) !== JSON.stringify([...DEFAULT_LABELS].sort());
      if (labelsChanged) params.set("labels", labels.join(","));
      if (showClaimed) params.set("showClaimed", "true");
    }
    const qs = params.toString();
    router.replace(`/explore${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [debouncedQuery, language, difficulty, sort, labels, showClaimed, activeTab, router]);

  const fetchIssues = useCallback(
    async (append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (language) params.set("language", language);
        if (difficulty !== "all") params.set("difficulty", difficulty);
        params.set("sort", sort);
        if (labels.length > 0) params.set("labels", labels.join(","));
        if (showClaimed) params.set("showClaimed", "true");
        if (append && endCursorRef.current) params.set("after", endCursorRef.current);

        // Phase 1: Fast fetch — issues without enrichment
        const res = await fetch(`/api/issues?${params.toString()}`);
        const data = await res.json();

        if (res.ok) {
          // Cast the raw issues as EnrichedIssue with missing enrichment fields
          const basicIssues: EnrichedIssue[] = data.issues.map((issue: GitHubIssue & { isBookmarked?: boolean }) => ({
            ...issue,
            healthScore: undefined as unknown as number,
            healthDetails: undefined as unknown as EnrichedIssue["healthDetails"],
            difficulty: undefined as unknown as DifficultyLevel,
            difficultyReason: "",
            difficultyUsedAI: false,
          }));

          let newIssueList: EnrichedIssue[];
          if (append) {
            const existingIds = new Set(rawIssues.map((i) => i.id));
            const deduped = basicIssues.filter((i) => !existingIds.has(i.id));
            newIssueList = [...rawIssues, ...deduped];
          } else {
            newIssueList = basicIssues;
          }

          setRawIssues(newIssueList);
          setTotalCount(data.totalCount);
          setEndCursor(data.pagination?.endCursor || null);
          setHasMore(data.pagination?.hasNextPage || false);
          setLoading(false);

          // Phase 2: Enrich in background
          const issuesToEnrich = append
            ? basicIssues.filter((i) => !new Set(rawIssues.map((r) => r.id)).has(i.id))
            : basicIssues;

          if (issuesToEnrich.length > 0) {
            const requestId = ++enrichRequestId.current;
            setEnriching(true);

            enrichIssues(issuesToEnrich).then((enrichmentMap) => {
              // Ignore stale responses
              if (requestId !== enrichRequestId.current) return;

              setRawIssues((prev) =>
                prev.map((issue) => {
                  const enrichment = enrichmentMap.get(issue.id);
                  if (enrichment) {
                    return { ...issue, ...enrichment };
                  }
                  return issue;
                })
              );
              setEnriching(false);
            }).catch(() => {
              if (requestId === enrichRequestId.current) {
                setEnriching(false);
              }
            });
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching issues:", error);
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, language, difficulty, sort, labels, showClaimed]
  );

  // GitHub handles global sort for newest/oldest/most-commented.
  // health-score must be sorted client-side.
  const CLIENT_SIDE_SORTS = ["health-score"];
  const issues = useMemo(() => {
    if (CLIENT_SIDE_SORTS.includes(sort)) {
      return sortIssues([...rawIssues], sort);
    }
    return rawIssues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawIssues, sort]);

  const fetchRecommendations = useCallback(async () => {
    if (!session) return;
    setRecLoading(true);
    try {
      const res = await fetch("/api/recommendations");
      const data = await res.json();
      if (res.ok) {
        setRecommendedIssues(data.issues);
        setUserLanguages(data.userLanguages || []);
        setUserTopics(data.userTopics || []);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setRecLoading(false);
    }
  }, [session]);

  // Fetch issues on initial load and whenever search is triggered
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchIssues(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTrigger, status]);

  useEffect(() => {
    if (activeTab === "recommended" && session && recommendedIssues.length === 0) {
      fetchRecommendations();
    }
  }, [activeTab, session, recommendedIssues.length, fetchRecommendations]);

  const handleSearch = () => {
    setRawIssues([]);
    setTotalCount(undefined);
    setEndCursor(null);
    setHasMore(false);
    enrichRequestId.current++; // Cancel any in-flight enrichment
    setEnriching(false);
    setSearchTrigger((t) => t + 1);
  };

  // Client-side filtering for recommendations (sorted by match score from API)
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendedIssues];

    // Filter by search query
    if (recQuery) {
      const q = recQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.body?.toLowerCase().includes(q) ||
          i.repository.nameWithOwner.toLowerCase().includes(q) ||
          i.labels.some((l) => l.name.toLowerCase().includes(q))
      );
    }

    // Filter by language
    if (recLanguage) {
      filtered = filtered.filter(
        (i) => i.repository.primaryLanguage?.name === recLanguage
      );
    }

    // Filter by difficulty
    if (recDifficulty !== "all") {
      filtered = filtered.filter((i) => i.difficulty === recDifficulty);
    }

    return filtered;
  }, [recommendedIssues, recQuery, recLanguage, recDifficulty]);


  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <IssueCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Explore Issues</h1>
          <p className="text-muted-foreground">
            Find beginner-friendly issues across thousands of open source projects.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Github className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">Sign in to explore issues</h2>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Connect your GitHub account to search and discover beginner-friendly
            open source issues with health scores and AI difficulty ratings.
          </p>
          <Button
            onClick={() => signIn("github")}
            size="lg"
            className="gap-2"
          >
            <Github className="h-5 w-5" />
            Sign in with GitHub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Explore Issues</h1>
        <p className="text-muted-foreground">
          Find beginner-friendly issues across thousands of open source projects.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          {session && (
            <TabsTrigger value="recommended" className="gap-2">
              <Sparkles className="h-4 w-4" />
              For You
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="search" className="space-y-6">
          <FilterBar
            query={query}
            language={language}
            difficulty={difficulty}
            sort={sort}
            labels={labels}
            showClaimed={showClaimed}
            onQueryChange={setQuery}
            onLanguageChange={setLanguage}
            onDifficultyChange={setDifficulty}
            onSortChange={setSort}
            onLabelsChange={setLabels}
            onShowClaimedChange={setShowClaimed}
            onSearch={handleSearch}
            totalCount={totalCount}
          />

          {loading && rawIssues.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <IssueCardSkeleton key={i} />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Frown className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-semibold">No issues found</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters or search terms.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} enriching={enriching} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => fetchIssues(true)}
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {session && (
          <TabsContent value="recommended" className="space-y-6">
            {/* Profile tags */}
            {userLanguages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Settings2 className="h-3.5 w-3.5" />
                  Your preferences:
                </span>
                {userLanguages.slice(0, 5).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setRecLanguage(recLanguage === lang ? "" : lang);
                    }}
                    className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-all ${
                      recLanguage === lang
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:border-emerald-500/40 dark:text-emerald-400"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
                {userTopics.slice(0, 3).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}

            {/* Lightweight filters for recommendations */}
            {recommendedIssues.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter recommendations..."
                    value={recQuery}
                    onChange={(e) => {
                      setRecQuery(e.target.value);
                      setRecVisibleCount(20);
                    }}
                    className="pl-9"
                  />
                </div>
                <Select
                  value={recDifficulty}
                  onValueChange={(v) => {
                    setRecDifficulty(v as DifficultyLevel | "all");
                    setRecVisibleCount(20);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {filteredRecommendations.length} issue{filteredRecommendations.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {recLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <IssueCardSkeleton key={i} />
                ))}
              </div>
            ) : recommendedIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">
                  Loading your recommendations...
                </h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;re analyzing your GitHub profile to find the best
                  matches.
                </p>
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Frown className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">No matches for these filters</h3>
                <p className="text-sm text-muted-foreground">
                  Try relaxing your filters to see more recommendations.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredRecommendations.slice(0, recVisibleCount).map((issue) => (
                    <IssueCard key={issue.id} issue={issue} />
                  ))}
                </div>

                {recVisibleCount < filteredRecommendations.length && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setRecVisibleCount((c) => c + 20)}
                      className="gap-2"
                    >
                      Load More ({filteredRecommendations.length - recVisibleCount} remaining)
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <IssueCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
