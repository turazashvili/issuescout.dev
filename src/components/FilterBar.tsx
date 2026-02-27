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
import { Search, X } from "lucide-react";
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

interface FilterBarProps {
  query: string;
  language: string;
  difficulty: DifficultyLevel | "all";
  sort: string;
  onQueryChange: (q: string) => void;
  onLanguageChange: (lang: string) => void;
  onDifficultyChange: (d: DifficultyLevel | "all") => void;
  onSortChange: (s: string) => void;
  onSearch: () => void;
  totalCount?: number;
}

export function FilterBar({
  query,
  language,
  difficulty,
  sort,
  onQueryChange,
  onLanguageChange,
  onDifficultyChange,
  onSortChange,
  onSearch,
  totalCount,
}: FilterBarProps) {
  const hasFilters = query || language || difficulty !== "all";

  const clearFilters = () => {
    onQueryChange("");
    onLanguageChange("");
    onDifficultyChange("all");
    onSortChange("newest");
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
          <SelectContent>
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
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => { onSortChange(v); onSearch(); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
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
