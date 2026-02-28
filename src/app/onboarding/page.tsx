"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GitBranch,
  Loader2,
  Check,
  Plus,
  X,
  ArrowRight,
  Sparkles,
  Code2,
  Boxes,
} from "lucide-react";

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
  "Scala",
  "Elixir",
  "Haskell",
  "Lua",
  "R",
  "Shell",
  "HTML",
  "CSS",
];

const POPULAR_FRAMEWORKS = [
  "React",
  "Next.js",
  "Vue",
  "Nuxt",
  "Angular",
  "Svelte",
  "SvelteKit",
  "Express",
  "Fastify",
  "NestJS",
  "Django",
  "Flask",
  "FastAPI",
  "Rails",
  "Spring Boot",
  "Laravel",
  "Tailwind CSS",
  "Node.js",
  "Deno",
  "Bun",
  "Docker",
  "Kubernetes",
  "Terraform",
  "GraphQL",
  "tRPC",
  "Prisma",
  "Drizzle",
  "MongoDB",
  "PostgreSQL",
  "Redis",
  "Electron",
  "React Native",
  "Flutter",
  "TensorFlow",
  "PyTorch",
];

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(0); // 0=loading, 1=languages, 2=frameworks, 3=done
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(
    new Set()
  );
  const [selectedFrameworks, setSelectedFrameworks] = useState<Set<string>>(
    new Set()
  );
  const [customLanguage, setCustomLanguage] = useState("");
  const [customFramework, setCustomFramework] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated") {
      fetchOnboardingData();
    }
  }, [status, router]);

  async function fetchOnboardingData() {
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();

      if (data.onboardingCompleted) {
        // Already onboarded, redirect to explore
        router.push("/explore?tab=recommended");
        return;
      }

      setDetectedLanguages(data.detected?.languages || []);
      setDetectedTopics(data.detected?.topics || []);

      // Pre-select detected languages
      const preSelected = new Set<string>(
        (data.detected?.languages || []).slice(0, 5)
      );
      setSelectedLanguages(preSelected);

      setLoading(false);
      setStep(1);
    } catch (error) {
      console.error("Error fetching onboarding data:", error);
      setLoading(false);
      setStep(1);
    }
  }

  function toggleLanguage(lang: string) {
    setSelectedLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  }

  function toggleFramework(fw: string) {
    setSelectedFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(fw)) {
        next.delete(fw);
      } else {
        next.add(fw);
      }
      return next;
    });
  }

  function addCustomLanguage() {
    const trimmed = customLanguage.trim();
    if (trimmed && !selectedLanguages.has(trimmed)) {
      setSelectedLanguages((prev) => new Set([...prev, trimmed]));
      setCustomLanguage("");
    }
  }

  function addCustomFramework() {
    const trimmed = customFramework.trim();
    if (trimmed && !selectedFrameworks.has(trimmed)) {
      setSelectedFrameworks((prev) => new Set([...prev, trimmed]));
      setCustomFramework("");
    }
  }

  async function handleComplete() {
    setSaving(true);
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languages: [...selectedLanguages],
          frameworks: [...selectedFrameworks],
        }),
      });
      setStep(3);
      // Brief pause to show success, then redirect
      setTimeout(() => {
        router.push("/explore?tab=recommended");
      }, 1500);
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-4 py-12">
        <div className="w-full space-y-6">
          <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-5 w-96" />
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <div className="pt-4 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Analyzing your GitHub profile...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-4 py-12">
      {/* Progress indicator */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                step >= s
                  ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white"
                  : "bg-muted text-muted-foreground"
              } ${step === 3 ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white" : ""}`}
            >
              {step > s || step === 3 ? (
                <Check className="h-4 w-4" />
              ) : (
                s
              )}
            </div>
            {s < 2 && (
              <div
                className={`h-0.5 w-12 rounded transition-all ${
                  step > s ? "bg-emerald-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 3: Done */}
      {step === 3 && (
        <Card className="w-full p-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">You&apos;re all set!</h2>
          <p className="text-muted-foreground">
            Redirecting to your personalized recommendations...
          </p>
          <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-emerald-500" />
        </Card>
      )}

      {/* Step 1: Languages */}
      {step === 1 && (
        <Card className="w-full p-6 animate-fade-in">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
              <Code2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">
              What languages do you work with?
            </h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll use this to find the best issues for you. Select all
              that apply.
            </p>
          </div>

          {/* Detected from GitHub */}
          {detectedLanguages.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                Detected from your GitHub profile
              </div>
              <div className="flex flex-wrap gap-2">
                {detectedLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedLanguages.has(lang)
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-card text-muted-foreground hover:border-emerald-500/50"
                    }`}
                  >
                    {selectedLanguages.has(lang) && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          )}

          {detectedLanguages.length > 0 && <Separator className="my-4" />}

          {/* All languages */}
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Popular languages
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_LANGUAGES.filter(
                (l) => !detectedLanguages.includes(l)
              ).map((lang) => (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedLanguages.has(lang)
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border bg-card text-muted-foreground hover:border-emerald-500/50"
                  }`}
                >
                  {selectedLanguages.has(lang) && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Custom language input */}
          <div className="mb-6 flex gap-2">
            <Input
              placeholder="Add another language..."
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomLanguage()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addCustomLanguage}
              disabled={!customLanguage.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected summary */}
          {selectedLanguages.size > 0 && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Selected ({selectedLanguages.size})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...selectedLanguages].map((lang) => (
                  <Badge
                    key={lang}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {lang}
                    <button
                      onClick={() => toggleLanguage(lang)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
            >
              Next: Frameworks
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Frameworks */}
      {step === 2 && (
        <Card className="w-full p-6 animate-fade-in">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-500">
              <Boxes className="h-6 w-6 text-white" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">
              Any frameworks or tools?
            </h2>
            <p className="text-sm text-muted-foreground">
              Optional but helps us find more relevant issues. Select any you&apos;re
              interested in contributing to.
            </p>
          </div>

          {/* Detected topics as suggestions */}
          {detectedTopics.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                Based on your starred repos
              </div>
              <div className="flex flex-wrap gap-2">
                {detectedTopics.slice(0, 10).map((topic) => (
                  <button
                    key={topic}
                    onClick={() => toggleFramework(topic)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedFrameworks.has(topic)
                        ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                        : "border-border bg-card text-muted-foreground hover:border-violet-500/50"
                    }`}
                  >
                    {selectedFrameworks.has(topic) && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    {topic}
                  </button>
                ))}
              </div>
              <Separator className="my-4" />
            </div>
          )}

          {/* Popular frameworks */}
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Popular frameworks & tools
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_FRAMEWORKS.map((fw) => (
                <button
                  key={fw}
                  onClick={() => toggleFramework(fw)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedFrameworks.has(fw)
                      ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                      : "border-border bg-card text-muted-foreground hover:border-violet-500/50"
                  }`}
                >
                  {selectedFrameworks.has(fw) && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {fw}
                </button>
              ))}
            </div>
          </div>

          {/* Custom framework input */}
          <div className="mb-6 flex gap-2">
            <Input
              placeholder="Add another framework or tool..."
              value={customFramework}
              onChange={(e) => setCustomFramework(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomFramework()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addCustomFramework}
              disabled={!customFramework.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected summary */}
          {selectedFrameworks.size > 0 && (
            <div className="mb-4 rounded-lg bg-muted/50 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Selected ({selectedFrameworks.size})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...selectedFrameworks].map((fw) => (
                  <Badge
                    key={fw}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {fw}
                    <button
                      onClick={() => toggleFramework(fw)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleComplete}
                disabled={saving}
              >
                Skip
              </Button>
              <Button
                onClick={handleComplete}
                disabled={saving}
                className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
                Find My Issues
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
