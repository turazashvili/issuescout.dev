"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { IssueCard } from "@/components/IssueCard";
import { IssueCardSkeleton } from "@/components/IssueCardSkeleton";
import { FilterBar } from "@/components/FilterBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EnrichedIssue, DifficultyLevel } from "@/types";
import { Sparkles, Search, Loader2, Frown } from "lucide-react";

function ExploreContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const initialTab = searchParams.get("tab") || "search";
  const initialQuery = searchParams.get("q") || "";
  const initialLanguage = searchParams.get("language") || "";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [language, setLanguage] = useState(initialLanguage);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | "all">("all");
  const [sort, setSort] = useState("newest");
  const [issues, setIssues] = useState<EnrichedIssue[]>([]);
  const [recommendedIssues, setRecommendedIssues] = useState<EnrichedIssue[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | undefined>();
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [userLanguages, setUserLanguages] = useState<string[]>([]);

  const fetchIssues = useCallback(
    async (append = false) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (language) params.set("language", language);
        if (difficulty !== "all") params.set("difficulty", difficulty);
        params.set("sort", sort);
        if (append && endCursor) params.set("after", endCursor);

        const res = await fetch(`/api/issues?${params.toString()}`);
        const data = await res.json();

        if (res.ok) {
          if (append) {
            setIssues((prev) => {
              const existingIds = new Set(prev.map((i: EnrichedIssue) => i.id));
              const newIssues = data.issues.filter((i: EnrichedIssue) => !existingIds.has(i.id));
              return [...prev, ...newIssues];
            });
          } else {
            setIssues(data.issues);
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
    [query, language, difficulty, sort, endCursor]
  );

  const fetchRecommendations = useCallback(async () => {
    if (!session) return;
    setRecLoading(true);
    try {
      const res = await fetch("/api/recommendations");
      const data = await res.json();
      if (res.ok) {
        setRecommendedIssues(data.issues);
        setUserLanguages(data.userLanguages || []);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setRecLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "recommended" && session && recommendedIssues.length === 0) {
      fetchRecommendations();
    }
  }, [activeTab, session, recommendedIssues.length, fetchRecommendations]);

  const handleSearch = () => {
    setEndCursor(null);
    setHasMore(false);
    fetchIssues(false);
  };

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
            onQueryChange={setQuery}
            onLanguageChange={setLanguage}
            onDifficultyChange={setDifficulty}
            onSortChange={setSort}
            onSearch={handleSearch}
            totalCount={totalCount}
          />

          {loading && issues.length === 0 ? (
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
            {userLanguages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  Based on your profile:
                </span>
                {userLanguages.slice(0, 5).map((lang) => (
                  <span
                    key={lang}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  >
                    {lang}
                  </span>
                ))}
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
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {recommendedIssues.map((issue) => (
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
