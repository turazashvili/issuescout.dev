"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthScoreBadge } from "@/components/HealthScoreBadge";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import type { HealthDetails, DifficultyLevel } from "@/types";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  GitFork,
  MessageSquare,
  Users,
  Clock,
  FileText,
  Shield,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";

interface IssueDetail {
  id: string;
  number: number;
  title: string;
  body: string;
  bodyHTML: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: string;
  labels: { name: string; color: string }[];
  author: { login: string; avatarUrl: string };
  comments: { totalCount: number };
  participants: {
    totalCount: number;
    nodes: { login: string; avatarUrl: string }[];
  };
  reactions: { totalCount: number };
  repository: {
    nameWithOwner: string;
    name: string;
    owner: { login: string; avatarUrl: string };
    description: string | null;
    url: string;
    stargazerCount: number;
    forkCount: number;
    primaryLanguage: { name: string; color: string } | null;
    licenseInfo: { name: string } | null;
    updatedAt: string;
    issues: { totalCount: number };
  };
}

export default function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [healthScore, setHealthScore] = useState(0);
  const [healthDetails, setHealthDetails] = useState<HealthDetails | null>(
    null
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("unknown");
  const [difficultyReason, setDifficultyReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchIssue() {
      try {
        const res = await fetch(`/api/issues/${id}`);
        const data = await res.json();

        if (res.ok) {
          setIssue(data.issue);
          setHealthScore(data.healthScore);
          setHealthDetails(data.healthDetails);
          setDifficulty(data.difficulty);
          setDifficultyReason(data.difficultyReason);
        } else {
          setError(data.error || "Failed to load issue");
        }
      } catch {
        setError("Failed to load issue");
      } finally {
        setLoading(false);
      }
    }

    fetchIssue();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-2 h-10 w-3/4" />
        <Skeleton className="mb-8 h-6 w-1/2" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center px-4 py-32 text-center">
        <h1 className="mb-2 text-2xl font-bold">Issue not found</h1>
        <p className="mb-6 text-muted-foreground">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/explore">Back to Explore</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/explore"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Explore
      </Link>

      {/* Issue header */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <img
            src={issue.repository.owner.avatarUrl}
            alt=""
            className="h-5 w-5 rounded-full"
          />
          <a
            href={issue.repository.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-foreground"
          >
            {issue.repository.nameWithOwner}
          </a>
          <span>#{issue.number}</span>
        </div>

        <h1 className="mb-4 text-2xl font-bold md:text-3xl">{issue.title}</h1>

        <div className="flex flex-wrap items-center gap-3">
          <HealthScoreBadge
            score={healthScore}
            details={healthDetails || undefined}
            size="md"
          />
          <DifficultyBadge
            difficulty={difficulty}
            reason={difficultyReason}
            size="md"
          />
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
            >
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </Button>
          </a>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 md:col-span-2">
          {/* Labels */}
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <Badge
                key={label.name}
                variant="outline"
                style={{
                  borderColor: `#${label.color}`,
                  color: `#${label.color}`,
                  backgroundColor: `#${label.color}15`,
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>

          {/* Issue body */}
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <img
                src={issue.author.avatarUrl}
                alt=""
                className="h-6 w-6 rounded-full"
              />
              <span className="font-medium text-foreground">
                {issue.author.login}
              </span>
              <span>opened this issue</span>
              <span>
                {new Date(issue.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            <Separator className="mb-4" />

            {issue.bodyHTML ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: issue.bodyHTML }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {issue.body || "No description provided."}
              </p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Repo info card */}
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Repository</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <img
                  src={issue.repository.owner.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
                <div>
                  <p className="font-medium">
                    {issue.repository.nameWithOwner}
                  </p>
                  {issue.repository.primaryLanguage && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            issue.repository.primaryLanguage.color,
                        }}
                      />
                      {issue.repository.primaryLanguage.name}
                    </span>
                  )}
                </div>
              </div>

              {issue.repository.description && (
                <p className="text-xs text-muted-foreground">
                  {issue.repository.description}
                </p>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  {issue.repository.stargazerCount.toLocaleString()} stars
                </div>
                <div className="flex items-center gap-1.5">
                  <GitFork className="h-3.5 w-3.5 text-blue-500" />
                  {issue.repository.forkCount.toLocaleString()} forks
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-purple-500" />
                  {issue.comments.totalCount} comments
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-green-500" />
                  {issue.participants.totalCount} participants
                </div>
              </div>
            </div>
          </Card>

          {/* Health report card */}
          {healthDetails && (
            <Card className="p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-emerald-500" />
                Community Health Report
              </h3>
              <div className="space-y-2.5 text-sm">
                <HealthRow
                  label="CONTRIBUTING.md"
                  value={healthDetails.hasContributing}
                />
                <HealthRow
                  label="License"
                  value={healthDetails.hasLicense}
                />
                <HealthRow
                  label="Recent Activity"
                  value={healthDetails.recentActivity}
                />

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Response Time
                  </span>
                  <span className="font-medium">
                    {healthDetails.responseTime}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Community
                  </span>
                  <span className="font-medium capitalize">
                    {healthDetails.communitySize}
                  </span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Overall Score</span>
                  <span className="text-lg font-bold text-emerald-500">
                    {healthScore}/100
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Quick actions */}
          <Card className="p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4" />
              Getting Started
            </h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>1. Read the issue description carefully</p>
              <p>2. Check the CONTRIBUTING.md guide</p>
              <p>3. Fork the repository</p>
              <p>4. Create a branch and make your changes</p>
              <p>5. Open a pull request</p>
            </div>
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block"
            >
              <Button className="w-full gap-2" size="sm">
                <ExternalLink className="h-4 w-4" />
                Start Contributing
              </Button>
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/50" />
      )}
    </div>
  );
}
