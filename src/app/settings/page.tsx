"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Settings,
  Loader2,
  Check,
  Plus,
  X,
  Save,
  Sparkles,
  Code2,
  Boxes,
  Github,
  RefreshCw,
} from "lucide-react";

const POPULAR_LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "Ruby",
  "C++", "C#", "PHP", "Swift", "Kotlin", "Dart", "Scala", "Elixir",
  "Haskell", "Lua", "R", "Shell", "HTML", "CSS",
];

const POPULAR_FRAMEWORKS = [
  "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "SvelteKit",
  "Express", "Fastify", "NestJS", "Django", "Flask", "FastAPI", "Rails",
  "Spring Boot", "Laravel", "Tailwind CSS", "Node.js", "Deno", "Bun",
  "Docker", "Kubernetes", "Terraform", "GraphQL", "tRPC", "Prisma",
  "Drizzle", "MongoDB", "PostgreSQL", "Redis", "Electron",
  "React Native", "Flutter", "TensorFlow", "PyTorch",
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<Set<string>>(new Set());
  const [selectedFrameworks, setSelectedFrameworks] = useState<Set<string>>(new Set());
  const [customLanguage, setCustomLanguage] = useState("");
  const [customFramework, setCustomFramework] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      fetchPreferences();
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  async function fetchPreferences() {
    try {
      const res = await fetch("/api/user/preferences");
      const data = await res.json();
      if (res.ok) {
        setDetectedLanguages(data.detectedLanguages || []);
        setDetectedTopics(data.detectedTopics || []);
        setSelectedLanguages(new Set(data.preferredLanguages || []));
        setSelectedFrameworks(new Set(data.preferredFrameworks || []));
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshFromGitHub() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      if (data.detected) {
        setDetectedLanguages(data.detected.languages || []);
        setDetectedTopics(data.detected.topics || []);
        // Add newly detected languages that aren't already selected
        setSelectedLanguages((prev) => {
          const next = new Set(prev);
          (data.detected.languages || []).slice(0, 5).forEach((l: string) => next.add(l));
          return next;
        });
      }
    } catch (error) {
      console.error("Error refreshing from GitHub:", error);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languages: [...selectedLanguages],
          frameworks: [...selectedFrameworks],
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  }

  function toggleLanguage(lang: string) {
    setSelectedLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) next.delete(lang);
      else next.add(lang);
      return next;
    });
  }

  function toggleFramework(fw: string) {
    setSelectedFrameworks((prev) => {
      const next = new Set(prev);
      if (next.has(fw)) next.delete(fw);
      else next.add(fw);
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

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-8 h-5 w-72" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto flex flex-col items-center justify-center px-4 py-32 text-center">
        <Settings className="mb-4 h-16 w-16 text-muted-foreground/30" />
        <h1 className="mb-2 text-2xl font-bold">Sign in to manage preferences</h1>
        <p className="mb-6 text-muted-foreground">
          Customize your language and framework preferences to get better recommendations.
        </p>
        <Button
          onClick={() => signIn("github")}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
        >
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
            <Settings className="h-6 w-6" />
            Preferences
          </h1>
          <p className="text-sm text-muted-foreground">
            Customize what issues we recommend for you.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshFromGitHub}
          disabled={refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-scan GitHub
        </Button>
      </div>

      {/* Languages */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Code2 className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Languages</h2>
        </div>

        {/* Detected */}
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
                  {selectedLanguages.has(lang) && <Check className="h-3.5 w-3.5" />}
                  {lang}
                </button>
              ))}
            </div>
            <Separator className="my-4" />
          </div>
        )}

        {/* Popular */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">All languages</div>
          <div className="flex flex-wrap gap-2">
            {POPULAR_LANGUAGES.filter((l) => !detectedLanguages.includes(l)).map((lang) => (
              <button
                key={lang}
                onClick={() => toggleLanguage(lang)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  selectedLanguages.has(lang)
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-card text-muted-foreground hover:border-emerald-500/50"
                }`}
              >
                {selectedLanguages.has(lang) && <Check className="h-3.5 w-3.5" />}
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Custom */}
        <div className="flex gap-2">
          <Input
            placeholder="Add another language..."
            value={customLanguage}
            onChange={(e) => setCustomLanguage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomLanguage()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={addCustomLanguage} disabled={!customLanguage.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected summary */}
        {selectedLanguages.size > 0 && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Selected ({selectedLanguages.size})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...selectedLanguages].map((lang) => (
                <Badge key={lang} variant="secondary" className="gap-1 pr-1">
                  {lang}
                  <button onClick={() => toggleLanguage(lang)} className="ml-0.5 rounded-full p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Frameworks */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Boxes className="h-5 w-5 text-violet-500" />
          <h2 className="text-lg font-semibold">Frameworks & Tools</h2>
        </div>

        {/* Detected topics */}
        {detectedTopics.length > 0 && (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Based on your starred repos
            </div>
            <div className="flex flex-wrap gap-2">
              {detectedTopics.slice(0, 15).map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleFramework(topic)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedFrameworks.has(topic)
                      ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                      : "border-border bg-card text-muted-foreground hover:border-violet-500/50"
                  }`}
                >
                  {selectedFrameworks.has(topic) && <Check className="h-3.5 w-3.5" />}
                  {topic}
                </button>
              ))}
            </div>
            <Separator className="my-4" />
          </div>
        )}

        {/* Popular frameworks */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Popular frameworks & tools</div>
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
                {selectedFrameworks.has(fw) && <Check className="h-3.5 w-3.5" />}
                {fw}
              </button>
            ))}
          </div>
        </div>

        {/* Custom */}
        <div className="flex gap-2">
          <Input
            placeholder="Add another framework or tool..."
            value={customFramework}
            onChange={(e) => setCustomFramework(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomFramework()}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={addCustomFramework} disabled={!customFramework.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected summary */}
        {selectedFrameworks.size > 0 && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Selected ({selectedFrameworks.size})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...selectedFrameworks].map((fw) => (
                <Badge key={fw} variant="secondary" className="gap-1 pr-1">
                  {fw}
                  <button onClick={() => toggleFramework(fw)} className="ml-0.5 rounded-full p-0.5 hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Save button */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-500 animate-fade-in">
            <Check className="h-4 w-4" />
            Preferences saved
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
