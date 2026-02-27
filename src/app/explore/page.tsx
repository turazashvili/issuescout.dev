"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { IssueCard } from "@/components/IssueCard";
import { IssueCardSkeleton } from "@/components/IssueCardSkeleton";
import { FilterBar } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EnrichedIssue, DifficultyLevel } from "@/types";
import { Sparkles, Search, Loader2, Frown, Settings2 } from "lucide-react";

function applyStarForkFilter(issues: EnrichedIssue[], minStars: number, minForks: number) {
  return issues.filter((i) => {
    if (minStars > 0 && i.repository.stargazerCount < minStars) return false;
    if (minForks > 0 && i.repository.forkCount < minForks) return false;
    return true;
  });
}

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
      sorted.sort((a, b) => (b.matchScore || b.healthScore) - (a.matchScore || a.healthScore));
      break;
  }
  return sorted;
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const initialTab = searchParams.get("tab") || "search";
  const initialQuery = searchParams.get("q") || "";
  const initialLanguage = searchParams.get("language") || "";

  const [activeTab, setActiveTab] = useState(initialTab);

  // Search tab state
  const [query, setQuery] = useState(initialQuery);
  const [language, setLanguage] = useState(initialLanguage);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "all">(
    (searchParams.get("difficulty") as DifficultyLevel) || "all"
  );
  const [sort, setSort] = useState(searchParams.get("sort") || "newest");
  const [minStars, setMinStars] = useState(parseInt(searchParams.get("minStars") || "0"));
  const [minForks, setMinForks] = useState(parseInt(searchParams.get("minForks") || "0"));
  const [rawIssues, setRawIssues] = useState<EnrichedIssue[]>([]);
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

  // Recommended tab filters (client-side)
  const [recQuery, setRecQuery] = useState("");
  const [recLanguage, setRecLanguage] = useState("");
  const [recDifficulty, setRecDifficulty] = useState<DifficultyLevel | "all">("all");
  const [recSort, setRecSort] = useState("health-score");
  const [recMinStars, setRecMinStars] = useState(0);
  const [recMinForks, setRecMinForks] = useState(0);

  // Use a ref to always get latest endCursor for "Load More" without
  // recreating the fetch function and causing extra renders
  const endCursorRef = useRef(endCursor);
  endCursorRef.current = endCursor;

  // Sync filter state → URL search params
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (language) params.set("language", language);
    if (difficulty !== "all") params.set("difficulty", difficulty);
    if (sort !== "newest") params.set("sort", sort);
    if (minStars > 0) params.set("minStars", String(minStars));
    if (minForks > 0) params.set("minForks", String(minForks));
    if (activeTab !== "search") params.set("tab", activeTab);
    const qs = params.toString();
    router.replace(`/explore${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [query, language, difficulty, sort, minStars, minForks, activeTab, router]);

  const fetchIssues = useCallback(
    async (append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (language) params.set("language", language);
        if (difficulty !== "all") params.set("difficulty", difficulty);
        params.set("sort", sort);
        if (minStars > 0) params.set("minStars", String(minStars));
        if (minForks > 0) params.set("minForks", String(minForks));
        if (append && endCursorRef.current) params.set("after", endCursorRef.current);

        const res = await fetch(`/api/issues?${params.toString()}`);
        const data = await res.json();

        if (res.ok) {
          if (append) {
            setRawIssues((prev) => {
              const existingIds = new Set(prev.map((i: EnrichedIssue) => i.id));
              const newIssues = data.issues.filter((i: EnrichedIssue) => !existingIds.has(i.id));
              return [...prev, ...newIssues];
            });
          } else {
            setRawIssues(data.issues);
          }
          setTotalCount(data.totalCount);
          setEndCursor(data.pagination?.endCursor || null);
          setHasMore(data.pagination?.hasNextPage || false);
        }
      } catch (error) {
        console.error("Error fetching issues:", error);
      } finally {
        setLoading(false);
      }
    },
    [query, language, difficulty, sort, minStars, minForks]
  );

  // GitHub handles global sort for newest/oldest/most-commented.
  // most-stars, most-forks, and health-score must be sorted client-side
  // because GitHub issue search doesn't support sorting by repo stars/forks.
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
    fetchIssues(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTrigger]);

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
    setSearchTrigger((t) => t + 1);
  };

  // Client-side filtering and sorting for recommendations
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

    // Filter by stars/forks
    filtered = applyStarForkFilter(filtered, recMinStars, recMinForks);

    // Sort
    filtered = sortIssues(filtered, recSort);

    return filtered;
  }, [recommendedIssues, recQuery, recLanguage, recDifficulty, recSort, recMinStars, recMinForks]);

  // No-op for recommended search (filtering is client-side/instant)
  const handleRecSearch = () => {};

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
            minStars={minStars}
            minForks={minForks}
            onQueryChange={setQuery}
            onLanguageChange={setLanguage}
            onDifficultyChange={setDifficulty}
            onSortChange={setSort}
            onMinStarsChange={setMinStars}
            onMinForksChange={setMinForks}
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
                {minStars > 0 || minForks > 0
                  ? "Try lowering the stars or forks minimum."
                  : "Try adjusting your filters or search terms."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
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

            {/* Filters for recommendations */}
            {recommendedIssues.length > 0 && (
              <FilterBar
                query={recQuery}
                language={recLanguage}
                difficulty={recDifficulty}
                sort={recSort}
                minStars={recMinStars}
                minForks={recMinForks}
                onQueryChange={setRecQuery}
                onLanguageChange={setRecLanguage}
                onDifficultyChange={setRecDifficulty}
                onSortChange={setRecSort}
                onMinStarsChange={setRecMinStars}
                onMinForksChange={setRecMinForks}
                onSearch={handleRecSearch}
                totalCount={filteredRecommendations.length}
              />
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
              <div className="grid gap-4 md:grid-cols-2">
                {filteredRecommendations.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} />
                ))}
              </div>
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
