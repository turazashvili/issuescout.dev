"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HealthDetails } from "@/types";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

interface HealthScoreBadgeProps {
  score: number;
  details?: HealthDetails;
  size?: "sm" | "md";
}

export function HealthScoreBadge({
  score,
  details,
  size = "sm",
}: HealthScoreBadgeProps) {
  const getColor = () => {
    if (score >= 70) return "text-emerald-500";
    if (score >= 40) return "text-amber-500";
    return "text-red-400";
  };

  const getBgColor = () => {
    if (score >= 70) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 40) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-400/10 border-red-400/20";
  };

  const getLabel = () => {
    if (score >= 70) return "Welcoming";
    if (score >= 40) return "Moderate";
    return "Low Activity";
  };

  const Icon = score >= 70 ? ShieldCheck : score >= 40 ? Shield : ShieldAlert;

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium",
        getBgColor(),
        getColor(),
        size === "sm" ? "text-xs" : "text-sm"
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      <span>{score}</span>
      <span className="hidden sm:inline">- {getLabel()}</span>
    </div>
  );

  if (!details) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Community Health Score: {score}/100</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>CONTRIBUTING.md</span>
              <span>{details.hasContributing ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span>License</span>
              <span>{details.hasLicense ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span>Recent Activity</span>
              <span>{details.recentActivity ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span>Response Time</span>
              <span>{details.responseTime}</span>
            </div>
            <div className="flex justify-between">
              <span>Community</span>
              <span className="capitalize">{details.communitySize}</span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
