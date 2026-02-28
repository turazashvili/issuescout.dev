"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Search, X, Tag, Check, Eye, EyeOff, Lock } from "lucide-react";
import type { DifficultyLevel } from "@/types";

const POPULAR_LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "Ruby",
  "C++",
  "C#",
  "PHP",
  "Swift",
  "Kotlin",
  "Dart",
  "HTML",
  "CSS",
  "Shell",
];

// All available issue labels, grouped for display
const LABEL_GROUPS = [
  {
    heading: "Beginner-Friendly",
    labels: [
      { value: "good first issue", display: "good first issue" },
      { value: "good-first-issue", display: "good-first-issue" },
      { value: "beginner", display: "beginner" },
      { value: "beginner-friendly", display: "beginner-friendly" },
      { value: "first-timers-only", display: "first-timers-only" },
      { value: "easy", display: "easy" },
      { value: "starter", display: "starter" },
      { value: "newbie", display: "newbie" },
    ],
  },
  {
    heading: "Contribution Type",
    labels: [
      { value: "help wanted", display: "help wanted" },
      { value: "up-for-grabs", display: "up-for-grabs" },
      { value: "low-hanging-fruit", display: "low-hanging-fruit" },
      { value: "contributions welcome", display: "contributions welcome" },
    ],
  },
  {
    heading: "Issue Type",
    labels: [
      { value: "bug", display: "bug" },
      { value: "enhancement", display: "enhancement" },
      { value: "feature", display: "feature" },
      { value: "documentation", display: "documentation" },
      { value: "refactor", display: "refactor" },
    ],
  },
  {
    heading: "Events",
    labels: [
      { value: "hacktoberfest", display: "hacktoberfest" },
    ],
  },
];

export const DEFAULT_LABELS = ["good first issue", "good-first-issue"];

interface FilterBarProps {
  query: string;
  language: string;
  difficulty: DifficultyLevel | "all";
  sort: string;
  labels: string[];
  showClaimed: boolean;
  onQueryChange: (q: string) => void;
  onLanguageChange: (lang: string) => void;
  onDifficultyChange: (d: DifficultyLevel | "all") => void;
  onSortChange: (s: string) => void;
  onLabelsChange: (labels: string[]) => void;
  onShowClaimedChange: (show: boolean) => void;
  onSearch: () => void;
  totalCount?: number;
}

export function FilterBar({
  query,
  language,
  difficulty,
  sort,
  labels,
  showClaimed,
  onQueryChange,
  onLanguageChange,
  onDifficultyChange,
  onSortChange,
  onLabelsChange,
  onShowClaimedChange,
  onSearch,
  totalCount,
}: FilterBarProps) {
  const [labelsOpen, setLabelsOpen] = useState(false);

  const hasFilters =
    query ||
    language ||
    difficulty !== "all" ||
    JSON.stringify(labels.sort()) !== JSON.stringify([...DEFAULT_LABELS].sort()) ||
    showClaimed;

  const clearFilters = () => {
    onQueryChange("");
    onLanguageChange("");
    onDifficultyChange("all");
    onSortChange("newest");
    onLabelsChange([...DEFAULT_LABELS]);
    onShowClaimedChange(false);
    onSearch();
  };

  const toggleLabel = (label: string) => {
    const next = labels.includes(label)
      ? labels.filter((l) => l !== label)
      : [...labels, label];
    onLabelsChange(next);
  };

  const labelTriggerText = () => {
    if (labels.length === 0) return "No labels";
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.length} labels`;
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search issues... (e.g., 'add dark mode', 'fix button')"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="pl-10"
          />
        </div>
        <Button
          onClick={onSearch}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
        >
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={language || "all"} onValueChange={(v) => { onLanguageChange(v === "all" ? "" : v); onSearch(); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            <SelectItem value="all">All Languages</SelectItem>
            {POPULAR_LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={difficulty} onValueChange={(v) => { onDifficultyChange(v as DifficultyLevel | "all"); onSearch(); }}>
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

        {/* Label multi-select */}
        <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={labelsOpen}
              className="w-[180px] justify-between gap-2 font-normal"
            >
              <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{labelTriggerText()}</span>
              <Badge variant="secondary" className="ml-auto h-5 rounded-full px-1.5 text-[10px]">
                {labels.length}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[260px] p-0" align="start">
            <div className="max-h-[320px] overflow-y-auto p-2">
              {LABEL_GROUPS.map((group) => (
                <div key={group.heading} className="mb-3 last:mb-0">
                  <p className="mb-1.5 px-2 text-xs font-medium text-muted-foreground">
                    {group.heading}
                  </p>
                  {group.labels.map((label) => {
                    const isSelected = labels.includes(label.value);
                    return (
                      <button
                        key={label.value}
                        onClick={() => toggleLabel(label.value)}
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">{label.display}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="border-t p-2">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    onLabelsChange([...DEFAULT_LABELS]);
                  }}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setLabelsOpen(false);
                    onSearch();
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Select value={sort} onValueChange={(v) => { onSortChange(v); onSearch(); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="most-commented">Most Discussed</SelectItem>
            <SelectItem value="most-reactions">Most Reactions</SelectItem>
            <SelectItem value="recently-updated">Recently Updated</SelectItem>
            <SelectItem value="health-score">Best Community</SelectItem>
          </SelectContent>
        </Select>

        {/* Show claimed toggle */}
        <button
          onClick={() => {
            onShowClaimedChange(!showClaimed);
            onSearch();
          }}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
            showClaimed
              ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
          title={showClaimed ? "Showing all issues including claimed ones" : "Showing only unclaimed issues"}
        >
          {showClaimed ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{showClaimed ? "Claimed" : "Unclaimed"}</span>
        </button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {totalCount !== undefined && (
          <Badge variant="secondary" className="ml-auto">
            {totalCount.toLocaleString()} issues found
          </Badge>
        )}
      </div>

      {/* Base filters — always active, shown for transparency */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Lock className="h-3 w-3 text-muted-foreground/50" />
        {[
          "Open",
          "Public",
          "Not Archived",
          ...(showClaimed ? [] : ["Unassigned", "No Linked PR"]),
        ].map((filter) => (
          <span
            key={filter}
            className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/70"
          >
            <Check className="h-2.5 w-2.5" />
            {filter}
          </span>
        ))}
      </div>
    </div>
  );
}
