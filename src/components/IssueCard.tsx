"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { DifficultyBadge } from "./DifficultyBadge";
import type { EnrichedIssue } from "@/types";
import {
  Star,
  GitFork,
  MessageSquare,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Clock,
} from "lucide-react";

interface IssueCardProps {
  issue: EnrichedIssue;
  onBookmarkToggle?: (issueId: string, isBookmarked: boolean) => void;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function IssueCard({ issue, onBookmarkToggle }: IssueCardProps) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = useState(issue.isBookmarked || false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session || bookmarkLoading) return;

    setBookmarkLoading(true);
    const newState = !bookmarked;

    try {
      const res = await fetch("/api/issues/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: issue.id,
          action: newState ? "add" : "remove",
        }),
      });

      if (res.ok) {
        setBookmarked(newState);
        onBookmarkToggle?.(issue.id, newState);
      }
    } catch {
      // Revert on error
    } finally {
      setBookmarkLoading(false);
    }
  };

  const languageColor = issue.repository.primaryLanguage?.color || "#6b7280";
  const languageName = issue.repository.primaryLanguage?.name || "Unknown";

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/50 p-5 transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-emerald-500/5">
      {/* Match score indicator */}
      {issue.matchScore && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-gradient-to-br from-emerald-500 to-cyan-500 px-2.5 py-1 text-xs font-bold text-white">
          {issue.matchScore}% match
        </div>
      )}

      {/* Header: repo info */}
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <a
          href={issue.repository.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-medium transition-colors hover:text-foreground"
        >
          <img
            src={issue.repository.owner.avatarUrl}
            alt={issue.repository.owner.login}
            className="h-4 w-4 rounded-full"
          />
          {issue.repository.nameWithOwner}
        </a>
        <span className="text-muted-foreground/50">/</span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: languageColor }}
          />
          {languageName}
        </span>
      </div>

      {/* Title */}
      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group/link"
      >
        <h3 className="mb-2 text-base font-semibold leading-snug transition-colors group-hover/link:text-emerald-500">
          {issue.title}
          <ExternalLink className="ml-1 inline h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-100" />
        </h3>
      </a>

      {/* Body preview */}
      {issue.body && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {issue.body.replace(/[#*`\[\]]/g, "").slice(0, 200)}
        </p>
      )}

      {/* Labels */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {issue.labels.slice(0, 4).map((label) => (
          <Badge
            key={label.name}
            variant="outline"
            className="border-opacity-30 text-xs"
            style={{
              borderColor: `#${label.color}`,
              color: `#${label.color}`,
              backgroundColor: `#${label.color}15`,
            }}
          >
            {label.name}
          </Badge>
        ))}
        {issue.labels.length > 4 && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            +{issue.labels.length - 4}
          </Badge>
        )}
      </div>

      {/* Health & Difficulty badges */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <HealthScoreBadge
          score={issue.healthScore}
          details={issue.healthDetails}
        />
        <DifficultyBadge
          difficulty={issue.difficulty}
          reason={issue.difficultyReason}
        />
      </div>

      {/* Footer: stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            {issue.repository.stargazerCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="h-3.5 w-3.5" />
            {issue.repository.forkCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {issue.comments.totalCount}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {timeAgo(issue.createdAt)}
          </span>
        </div>

        {session && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleBookmark}
            disabled={bookmarkLoading}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <Bookmark className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
