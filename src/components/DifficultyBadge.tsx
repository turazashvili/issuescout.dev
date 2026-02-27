"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DifficultyLevel } from "@/types";

interface DifficultyBadgeProps {
  difficulty: DifficultyLevel;
  reason?: string;
  size?: "sm" | "md";
}

const config: Record<
  DifficultyLevel,
  { label: string; color: string; bg: string; icon: string }
> = {
  easy: {
    label: "Easy",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    icon: "1",
  },
  medium: {
    label: "Medium",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    icon: "2",
  },
  hard: {
    label: "Hard",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: "3",
  },
  unknown: {
    label: "Unknown",
    color: "text-muted-foreground",
    bg: "bg-muted border-muted",
    icon: "?",
  },
};

export function DifficultyBadge({
  difficulty,
  reason,
  size = "sm",
}: DifficultyBadgeProps) {
  const c = config[difficulty];

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium",
        c.bg,
        c.color,
        size === "sm" ? "text-xs" : "text-sm"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full bg-current/10 font-bold",
          size === "sm" ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-xs"
        )}
      >
        {c.icon}
      </span>
      {c.label}
    </div>
  );

  if (!reason) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-sm">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
}
