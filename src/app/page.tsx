"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  GitBranch,
  Shield,
  Brain,
  Sparkles,
  Github,
  ArrowRight,
  Star,
  Users,
  Code2,
  Heart,
  CheckCircle2,
} from "lucide-react";

const FEATURED_LANGUAGES = [
  { name: "JavaScript", color: "#f1e05a" },
  { name: "TypeScript", color: "#3178c6" },
  { name: "Python", color: "#3572A5" },
  { name: "Go", color: "#00ADD8" },
  { name: "Rust", color: "#dea584" },
  { name: "Java", color: "#b07219" },
  { name: "Ruby", color: "#701516" },
  { name: "C++", color: "#f34b7d" },
];

const FEATURES = [
  {
    icon: Shield,
    title: "Community Health Score",
    description:
      "Each repo gets a 1-100 score based on response times, CONTRIBUTING.md, activity, and more. Know before you contribute.",
    gradient: "from-emerald-500 to-green-500",
  },
  {
    icon: Brain,
    title: "AI Difficulty Estimation",
    description:
      "AI analyzes each issue to estimate difficulty level. Find issues that match your experience - whether you're starting out or looking for a challenge.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Sparkles,
    title: "Personalized Matches",
    description:
      "Sign in with GitHub and get issues matched to your skills. We analyze your repos and stars to find perfect first issues for you.",
    gradient: "from-amber-500 to-orange-500",
  },
];

const STATIC_STATS = [
  { icon: Code2, label: "Languages", value: "50+" },
  { icon: Heart, label: "Open Source", value: "Always" },
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [reposIndexed, setReposIndexed] = useState<number | null>(null);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [surveyVote, setSurveyVote] = useState<"yes" | "no" | null>(null);
  const [surveyResults, setSurveyResults] = useState<{ yes: number; no: number } | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const animFrameRef = useRef<number | null>(null);

  // Redirect to onboarding if user is signed in but hasn't completed it
  useEffect(() => {
    if (session?.user?.githubId) {
      fetch("/api/user/preferences")
        .then((res) => res.json())
        .then((data) => {
          if (data.onboardingCompleted === false) {
            router.push("/onboarding");
          }
        })
        .catch(() => {});
    }
  }, [session, router]);

  // Fetch real stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setReposIndexed(data.reposIndexed || 0))
      .catch(() => setReposIndexed(0));
  }, []);

  // Animate count-up when reposIndexed loads
  useEffect(() => {
    if (reposIndexed === null) return;
    if (reposIndexed === 0) {
      setDisplayedCount(0);
      return;
    }

    const duration = 800;
    const start = performance.now();
    const target = reposIndexed;

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayedCount(Math.round(eased * target));
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [reposIndexed]);

  // Load survey state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("survey-opensource-vote");
    if (saved === "yes" || saved === "no") {
      setSurveyVote(saved);
      fetch("/api/survey")
        .then((res) => res.json())
        .then((data) => setSurveyResults(data))
        .catch(() => {});
    }
  }, []);

  const handleSurveyVote = async (vote: "yes" | "no") => {
    if (surveyVote || surveyLoading) return;
    setSurveyLoading(true);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      const data = await res.json();
      setSurveyVote(vote);
      setSurveyResults(data);
      localStorage.setItem("survey-opensource-vote", vote);
    } catch {
      // silently fail
    } finally {
      setSurveyLoading(false);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    router.push(`/explore?${params.toString()}`);
  };

  const handleLanguageClick = (lang: string) => {
    router.push(`/explore?language=${encodeURIComponent(lang)}`);
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Survey Banner */}
      <div className="border-b border-border/40 bg-muted/40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
            {!surveyVote ? (
              <>
                <span className="text-sm font-medium">
                  Should we open source IssueScout?
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSurveyVote("yes")}
                    disabled={surveyLoading}
                    className="h-7 gap-1.5 border-emerald-500/30 px-3 text-xs hover:border-emerald-500 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Yes, open source it
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSurveyVote("no")}
                    disabled={surveyLoading}
                    className="h-7 px-3 text-xs"
                  >
                    No, keep it closed
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Thanks for voting!
                </span>
                {surveyResults && (() => {
                  const total = surveyResults.yes + surveyResults.no;
                  const yesPct = total > 0 ? Math.round((surveyResults.yes / total) * 100) : 0;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex h-2 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${yesPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {yesPct}% yes ({total} votes)
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 blur-3xl" />

        <div className="container relative mx-auto px-4 pb-20 pt-20 md:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <Badge
              variant="outline"
              className="mb-6 gap-1.5 border-emerald-500/30 bg-emerald-500/5 px-4 py-1.5 text-sm text-emerald-600 dark:text-emerald-400"
            >
              <GitBranch className="h-3.5 w-3.5" />
              Your gateway to open source
            </Badge>

            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              Find your{" "}
              <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                first issue
              </span>
              <br />
              in open source
            </h1>

            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              Discover beginner-friendly issues enriched with community health
              scores, AI difficulty ratings, and personalized recommendations.
              Making your first contribution has never been easier.
            </p>

            {/* Search bar */}
            <div className="mx-auto mb-6 flex max-w-xl gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search for issues... (e.g., 'add dark mode')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-12 pl-11 text-base"
                />
              </div>
              <Button
                onClick={handleSearch}
                size="lg"
                className="h-12 gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 text-white hover:from-emerald-600 hover:to-cyan-600"
              >
                Explore
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick language filters */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Popular:</span>
              {FEATURED_LANGUAGES.map((lang) => (
                <button
                  key={lang.name}
                  onClick={() => handleLanguageClick(lang.name)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/50 px-3 py-1 text-sm transition-colors hover:border-border hover:bg-card"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: lang.color }}
                  />
                  {lang.name}
                </button>
              ))}
            </div>

            {/* CTA for non-authenticated users */}
            {!session && (
              <div className="mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => signIn("github")}
                  className="gap-2"
                >
                  <Github className="h-5 w-5" />
                  Sign in for personalized recommendations
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-6">
            {STATIC_STATS.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <stat.icon className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Star className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                {reposIndexed === null ? (
                  <div className="h-5 w-10 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-lg font-bold">{displayedCount.toLocaleString()}</p>
                )}
                <p className="text-xs text-muted-foreground">Repos Indexed</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Not just another issue finder
          </h2>
          <p className="text-muted-foreground">
            We go beyond GitHub&apos;s search to give you the intelligence you need
            to make your first contribution with confidence.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border/50 bg-card/50 p-6 transition-all hover:border-border hover:shadow-lg"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient}`}
              >
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-4 text-3xl font-bold">How it works</h2>
            <p className="text-muted-foreground">
              Three simple steps to your first open source contribution.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Search & Filter",
                description:
                  "Browse issues by language, difficulty, or keyword. Use our smart filters to find exactly what you're looking for.",
              },
              {
                step: "02",
                title: "Evaluate & Choose",
                description:
                  "Check the community health score and difficulty rating. Pick an issue from a welcoming repo that matches your skill level.",
              },
              {
                step: "03",
                title: "Contribute & Grow",
                description:
                  "Click through to GitHub and make your contribution. Save issues to track your journey into open source.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button
              onClick={() => router.push("/explore")}
              size="lg"
              className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
            >
              Start Exploring
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30">
        <div className="container mx-auto flex items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span>IssueScout</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for the open source community
          </p>
        </div>
      </footer>
    </div>
  );
}
