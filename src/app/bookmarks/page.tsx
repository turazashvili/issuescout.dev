"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { IssueCard } from "@/components/IssueCard";
import { IssueCardSkeleton } from "@/components/IssueCardSkeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EnrichedIssue } from "@/types";
import { Bookmark, Github, Frown, Archive } from "lucide-react";

export default function BookmarksPage() {
  const { data: session, status } = useSession();

  const [activeTab, setActiveTab] = useState("active");
  const [activeIssues, setActiveIssues] = useState<EnrichedIssue[]>([]);
  const [archivedIssues, setArchivedIssues] = useState<EnrichedIssue[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedLoaded, setArchivedLoaded] = useState(false);

  const fetchBookmarks = useCallback(
    async (bookmarkStatus: "active" | "archived") => {
      try {
        const res = await fetch(
          `/api/issues/bookmark?status=${bookmarkStatus}`
        );
        const data = await res.json();
        if (res.ok) {
          return data.issues || [];
        }
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      }
      return [];
    },
    []
  );

  // Fetch active bookmarks on load
  useEffect(() => {
    if (!session) {
      setActiveLoading(false);
      return;
    }

    (async () => {
      setActiveLoading(true);
      const issues = await fetchBookmarks("active");
      setActiveIssues(issues);
      setActiveLoading(false);
    })();
  }, [session, fetchBookmarks]);

  // Fetch archived bookmarks when tab is first opened
  useEffect(() => {
    if (activeTab === "archived" && session && !archivedLoaded) {
      (async () => {
        setArchivedLoading(true);
        const issues = await fetchBookmarks("archived");
        setArchivedIssues(issues);
        setArchivedLoading(false);
        setArchivedLoaded(true);
      })();
    }
  }, [activeTab, session, archivedLoaded, fetchBookmarks]);

  const handleBookmarkToggle = (issueId: string, isBookmarked: boolean) => {
    if (!isBookmarked) {
      // Removed from active
      setActiveIssues((prev) => prev.filter((i) => i.id !== issueId));
      // Also remove from archived if present
      setArchivedIssues((prev) => prev.filter((i) => i.id !== issueId));
    }
  };

  const handleArchiveToggle = (issueId: string, isArchived: boolean) => {
    if (isArchived) {
      // Move from active to archived
      const issue = activeIssues.find((i) => i.id === issueId);
      setActiveIssues((prev) => prev.filter((i) => i.id !== issueId));
      if (issue) {
        setArchivedIssues((prev) => [
          { ...issue, isArchived: true } as EnrichedIssue,
          ...prev,
        ]);
      }
    } else {
      // Move from archived to active
      const issue = archivedIssues.find((i) => i.id === issueId);
      setArchivedIssues((prev) => prev.filter((i) => i.id !== issueId));
      if (issue) {
        setActiveIssues((prev) => [
          { ...issue, isArchived: false } as EnrichedIssue,
          ...prev,
        ]);
      }
    }
  };

  if (status === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <IssueCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center px-4 py-32 text-center">
        <Bookmark className="mb-4 h-16 w-16 text-muted-foreground/30" />
        <h1 className="mb-2 text-2xl font-bold">Sign in to save issues</h1>
        <p className="mb-6 text-muted-foreground">
          Bookmark issues you&apos;re interested in and track your open source
          journey.
        </p>
        <Button
          onClick={() => signIn("github")}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
        >
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </Button>
      </div>
    );
  }

  const renderIssueList = (
    issues: EnrichedIssue[],
    loading: boolean,
    emptyIcon: React.ReactNode,
    emptyTitle: string,
    emptyDescription: string,
    isArchivedTab: boolean
  ) => {
    if (loading) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <IssueCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (issues.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {emptyIcon}
          <h3 className="mb-2 text-lg font-semibold">{emptyTitle}</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
          {!isArchivedTab && (
            <Button variant="outline" asChild>
              <a href="/explore">Explore Issues</a>
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2">
        {issues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onBookmarkToggle={handleBookmarkToggle}
            onArchiveToggle={handleArchiveToggle}
            showArchiveButton={!isArchivedTab}
            showUnarchiveButton={isArchivedTab}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
          <Bookmark className="h-7 w-7" />
          Saved Issues
        </h1>
        <p className="text-muted-foreground">
          Issues you&apos;ve bookmarked for later.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="active" className="gap-2">
            <Bookmark className="h-4 w-4" />
            Saved
            {activeIssues.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {activeIssues.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="archived" className="gap-2">
            <Archive className="h-4 w-4" />
            Archived
            {archivedIssues.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {archivedIssues.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {renderIssueList(
            activeIssues,
            activeLoading,
            <Frown className="mb-4 h-12 w-12 text-muted-foreground/50" />,
            "No saved issues yet",
            "Browse issues and click the bookmark icon to save them here.",
            false
          )}
        </TabsContent>

        <TabsContent value="archived">
          {renderIssueList(
            archivedIssues,
            archivedLoading,
            <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />,
            "No archived issues",
            "Archive issues you've completed or want to revisit later.",
            true
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
