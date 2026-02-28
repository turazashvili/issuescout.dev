---
title: IssueScout — Find Your First Open Source Contribution (Without the Guesswork)
published: true
tags: devchallenge, weekendchallenge, showdev
---

*This is a submission for the [DEV Weekend Challenge: Community](https://dev.to/challenges/weekend-2026-02-28)*

## The Community

Open source contributors — specifically, developers who *want* to contribute but don't know where to start.

If you've ever searched GitHub for "good first issue," you know the problem: thousands of results, no way to tell which repos actually welcome newcomers, and no sense of whether an issue labeled "easy" will take you an hour or a week. Many "good first issues" sit in abandoned repos where no one will ever review your PR. Others are mislabeled — they require deep domain knowledge despite the friendly tag.

The open source contributor community loses potential members every day to this friction. IssueScout is built to fix that.

## What I Built

**IssueScout** is an open source issue discovery platform that helps developers find their ideal first contribution. It enriches GitHub's "good first issue" results with two things GitHub doesn't provide:

**1. Community Health Score (0–100)** — A 7-factor score computed per repository:
- Has CONTRIBUTING.md (15 pts)
- Has a license (10 pts)
- Has a code of conduct (5 pts)
- Recent commit activity within 30/90 days (20 pts)
- Star count as a popularity signal (15 pts)
- Average issue response time (20 pts)
- Merged PR count as a maintenance signal (15 pts)

A repo scoring 80+ is actively maintained, welcomes contributors, and will likely review your PR. A repo scoring 20 might have a "good first issue" label but no one home.

**2. AI Difficulty Estimation** — Each issue gets a difficulty rating (Easy / Medium / Hard) using a two-tier approach: a fast rule-based analyzer checks keywords, labels, and comment count first. If confidence is below 80%, it falls back to GPT-4o-mini for deeper analysis. A purple sparkle icon indicates when AI was used, so there's full transparency.

**Other features:**
- **Personalized "For You" tab** — During onboarding, IssueScout detects your GitHub languages and topics, then recommends issues matching your stack
- **18 label filters across 4 categories** — Filter by difficulty, type, area, and framework labels
- **Bookmarks with archiving** — Save issues for later, archive completed ones
- **Progressive loading** — Issues appear instantly, health scores and difficulty badges fill in as enrichment completes
- **Dark mode** — Because of course

## Demo

**Live app:** [issuescout-delta.vercel.app](https://issuescout-delta.vercel.app)

Sign in with GitHub to start exploring. The app uses your GitHub OAuth token for API requests (each user gets 5,000 requests/hour), so there's no shared rate limit bottleneck.

### How it works:

1. **Sign in** with GitHub → auto-detects your languages and interests
2. **Search** for issues by language, or browse **"For You"** recommendations
3. **Filter** by labels, sort by newest/most commented/most reactions
4. **Check the health score** — green (70+) means the repo actively welcomes contributors
5. **Check the difficulty** — find issues that match your experience level
6. **Click through** to the issue detail page for a full health breakdown
7. **Bookmark** issues you want to tackle later

## Code

{% github turazashvili/issuescout.dev %}

The entire codebase is open source. Key files:

- [`src/services/healthScore.ts`](https://github.com/turazashvili/issuescout.dev/blob/main/src/services/healthScore.ts) — The 7-factor health scoring algorithm
- [`src/services/difficulty.ts`](https://github.com/turazashvili/issuescout.dev/blob/main/src/services/difficulty.ts) — Two-tier difficulty estimation (rule-based + GPT-4o-mini)
- [`src/services/github.ts`](https://github.com/turazashvili/issuescout.dev/blob/main/src/services/github.ts) — GitHub GraphQL API integration
- [`src/models/IndexedRepo.ts`](https://github.com/turazashvili/issuescout.dev/blob/main/src/models/IndexedRepo.ts) — Permanent repo health cache with stale-while-revalidate
- [`src/app/api/issues/enrich/route.ts`](https://github.com/turazashvili/issuescout.dev/blob/main/src/app/api/issues/enrich/route.ts) — Two-level cache enrichment pipeline

## How I Built It

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · NextAuth v5 · MongoDB Atlas · OpenAI GPT-4o-mini · GitHub GraphQL API · Vercel

**Architecture decisions that mattered:**

**Per-user OAuth tokens instead of a server PAT.** GitHub's API gives 5,000 requests/hour per authenticated user. Instead of burning through a single server token, each user's own OAuth token powers their searches. This means the app scales linearly with users — 100 concurrent users = 500K requests/hour of capacity.

**Two-phase progressive loading.** The search API returns raw GitHub results instantly. A separate enrichment endpoint handles health scores and difficulty estimation in the background. Issue cards render immediately with skeleton badges that fill in as enrichment completes. The user never stares at a loading spinner.

**Two-level caching.** Issue difficulty is cached for 24 hours (L1). Repo health scores are cached permanently in an `IndexedRepo` collection with stale-while-revalidate at 48 hours (L2). The first user to hit a repo pays the cost; every subsequent user gets instant results. Over time, the IndexedRepo collection builds into a growing database of scored repositories.

**Rule-based AI with transparent fallback.** Most issues can be classified by keywords and labels alone ("typo" → Easy, "refactor authentication" → Hard). GPT-4o-mini only fires when the rule engine isn't confident enough. The purple sparkle on the difficulty badge tells users exactly when AI was involved. This keeps costs minimal and latency low.

**What I learned building this in a weekend:**
- GitHub's issue search API doesn't support `stars:` or `forks:` qualifiers — those only work on repository search. Had to build difficulty filtering as a post-fetch step.
- Mongoose's `{ new: true }` option is deprecated in v9 — use `{ returnDocument: "after" }`.
- NextAuth JWT tokens are static snapshots. Storing mutable state (like `onboardingCompleted`) in the JWT means it goes stale after the user completes onboarding. The fix: always verify against the database.
- GitHub GraphQL reserves `query` as a parameter name, so you can't use it as a variable name in your operations.

Built with Claude as a coding partner throughout the weekend.

<!-- Thanks for participating! -->
