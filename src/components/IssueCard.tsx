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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Star,
  GitFork,
  MessageSquare,
  ThumbsUp,
  Bookmark,
  ExternalLink,
  Clock,
  Archive,
  ArchiveRestore,
} from "lucide-react";

interface IssueCardProps {
  issue: EnrichedIssue & { isArchived?: boolean };
  onBookmarkToggle?: (issueId: string, isBookmarked: boolean) => void;
  onArchiveToggle?: (issueId: string, isArchived: boolean) => void;
  showArchiveButton?: boolean;
  showUnarchiveButton?: boolean;
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

export function IssueCard({
  issue,
  onBookmarkToggle,
  onArchiveToggle,
  showArchiveButton = false,
  showUnarchiveButton = false,
}: IssueCardProps) {
  const { data: session } = useSession();
  const [bookmarked, setBookmarked] = useState(issue.isBookmarked || false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session || bookmarkLoading) return;

    setBookmarkLoading(true);
    const newState = !bookmarked;

    try {
      // Strip isBookmarked/isArchived before sending as issueData
      const { isBookmarked: _ib, ...issueData } = issue as EnrichedIssue & { isArchived?: boolean };
      const { isArchived: _ia, ...cleanIssueData } = issueData;

      const res = await fetch("/api/issues/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueId: issue.id,
          action: newState ? "add" : "remove",
          ...(newState ? { issueData: cleanIssueData } : {}),
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

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session || archiveLoading) return;

    setArchiveLoading(true);
    const action = issue.isArchived ? "unarchive" : "archive";

    try {
      const res = await fetch("/api/issues/bookmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, action }),
      });

      if (res.ok) {
        onArchiveToggle?.(issue.id, action === "archive");
      }
    } catch {
      // ignore
    } finally {
      setArchiveLoading(false);
    }
  };

  const languageColor = issue.repository.primaryLanguage?.color || "#6b7280";
  const languageName = issue.repository.primaryLanguage?.name || "Unknown";

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/50 p-5 transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-emerald-500/5">
      {/* Top-right actions */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {issue.matchScore && (
          <span className="rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 px-2 py-0.5 text-xs font-bold text-white">
            {issue.matchScore}% match
          </span>
        )}
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

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
      >
        <h3 className="mb-2 pr-16 text-base font-semibold leading-snug transition-colors hover:text-emerald-500">
          {issue.title}
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
          usedAI={issue.difficultyUsedAI}
        />
      </div>

      {/* Footer: stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                {issue.repository.stargazerCount.toLocaleString()}
              </span>
            </TooltipTrigger>
            <TooltipContent>Repository stars</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                {issue.repository.forkCount.toLocaleString()}
              </span>
            </TooltipTrigger>
            <TooltipContent>Repository forks</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {issue.comments.totalCount}
              </span>
            </TooltipTrigger>
            <TooltipContent>Issue comments</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                {issue.reactions?.totalCount || 0}
              </span>
            </TooltipTrigger>
            <TooltipContent>Issue reactions</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {timeAgo(issue.createdAt)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{new Date(issue.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</TooltipContent>
          </Tooltip>
        </div>

        {session && (
          <div className="flex items-center gap-1">
            {showArchiveButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleArchive}
                disabled={archiveLoading}
                title="Archive"
              >
                <Archive className="h-4 w-4 text-muted-foreground hover:text-blue-500" />
              </Button>
            )}
            {showUnarchiveButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleArchive}
                disabled={archiveLoading}
                title="Unarchive"
              >
                <ArchiveRestore className="h-4 w-4 text-muted-foreground hover:text-emerald-500" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleBookmark}
              disabled={bookmarkLoading}
              title={bookmarked ? "Remove bookmark" : "Bookmark"}
            >
              {bookmarked ? (
                <Bookmark className="h-4 w-4 fill-amber-400 text-amber-400" />
              ) : (
                <Bookmark className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
