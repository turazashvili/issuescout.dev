"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X, Star, GitFork } from "lucide-react";
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

const STAR_OPTIONS = [
  { value: "0", label: "Any Stars" },
  { value: "10", label: "10+" },
  { value: "50", label: "50+" },
  { value: "100", label: "100+" },
  { value: "500", label: "500+" },
  { value: "1000", label: "1K+" },
  { value: "5000", label: "5K+" },
  { value: "10000", label: "10K+" },
];

const FORK_OPTIONS = [
  { value: "0", label: "Any Forks" },
  { value: "5", label: "5+" },
  { value: "10", label: "10+" },
  { value: "50", label: "50+" },
  { value: "100", label: "100+" },
  { value: "500", label: "500+" },
  { value: "1000", label: "1K+" },
];

interface FilterBarProps {
  query: string;
  language: string;
  difficulty: DifficultyLevel | "all";
  sort: string;
  minStars: number;
  minForks: number;
  onQueryChange: (q: string) => void;
  onLanguageChange: (lang: string) => void;
  onDifficultyChange: (d: DifficultyLevel | "all") => void;
  onSortChange: (s: string) => void;
  onMinStarsChange: (n: number) => void;
  onMinForksChange: (n: number) => void;
  onSearch: () => void;
  totalCount?: number;
}

export function FilterBar({
  query,
  language,
  difficulty,
  sort,
  minStars,
  minForks,
  onQueryChange,
  onLanguageChange,
  onDifficultyChange,
  onSortChange,
  onMinStarsChange,
  onMinForksChange,
  onSearch,
  totalCount,
}: FilterBarProps) {
  const hasFilters =
    query || language || difficulty !== "all" || minStars > 0 || minForks > 0;

  const clearFilters = () => {
    onQueryChange("");
    onLanguageChange("");
    onDifficultyChange("all");
    onSortChange("newest");
    onMinStarsChange(0);
    onMinForksChange(0);
    onSearch();
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

        <Select value={String(minStars)} onValueChange={(v) => { onMinStarsChange(Number(v)); onSearch(); }}>
          <SelectTrigger className="w-[130px]">
            <span className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent position="popper">
            {STAR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(minForks)} onValueChange={(v) => { onMinForksChange(Number(v)); onSearch(); }}>
          <SelectTrigger className="w-[130px]">
            <span className="flex items-center gap-1.5">
              <GitFork className="h-3.5 w-3.5 text-blue-500" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent position="popper">
            {FORK_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { onSortChange(v); onSearch(); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="most-commented">Most Discussed</SelectItem>
            <SelectItem value="health-score">Best Community</SelectItem>
          </SelectContent>
        </Select>

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
    </div>
  );
}
