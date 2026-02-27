"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { IssueCard } from "@/components/IssueCard";
import { IssueCardSkeleton } from "@/components/IssueCardSkeleton";
import { Button } from "@/components/ui/button";
import type { EnrichedIssue } from "@/types";
import { Bookmark, Github, Frown } from "lucide-react";

export default function BookmarksPage() {
  const { data: session, status } = useSession();
  const [issues, setIssues] = useState<EnrichedIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    async function fetchBookmarkedIssues() {
      try {
        // Fetch bookmarks first, then fetch issue details
        const bookmarkRes = await fetch("/api/issues/bookmark");
        const bookmarkData = await bookmarkRes.json();

        if (bookmarkData.bookmarks?.length > 0) {
          // For now, we fetch all issues and filter
          // In production, we'd have a dedicated endpoint
          const res = await fetch("/api/issues?limit=30");
          const data = await res.json();

          if (res.ok) {
            const bookmarkSet = new Set(bookmarkData.bookmarks);
            const bookmarked = data.issues.filter(
              (i: EnrichedIssue) => bookmarkSet.has(i.id)
            );
            setIssues(
              bookmarked.map((i: EnrichedIssue) => ({
                ...i,
                isBookmarked: true,
              }))
            );
          }
        }
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBookmarkedIssues();
  }, [session]);

  const handleBookmarkToggle = (issueId: string, isBookmarked: boolean) => {
    if (!isBookmarked) {
      setIssues((prev) => prev.filter((i) => i.id !== issueId));
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

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <IssueCardSkeleton key={i} />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Frown className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">No saved issues yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Browse issues and click the bookmark icon to save them here.
          </p>
          <Button variant="outline" asChild>
            <a href="/explore">Explore Issues</a>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onBookmarkToggle={handleBookmarkToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
