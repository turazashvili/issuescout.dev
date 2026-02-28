<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47a248?style=flat-square&logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

# IssueScout

**Find your first open source contribution — without the guesswork.**

IssueScout is an open source issue discovery platform that surfaces GitHub "good first issue" labeled issues enriched with community health scores, AI difficulty estimation, and personalized recommendations. Stop scrolling through abandoned repos and mislabeled issues — find welcoming projects that match your skills.

<p align="center">
  <strong><a href="https://issuescout-delta.vercel.app">Live Demo</a></strong>
</p>

<!-- Add a screenshot here: ![IssueScout Screenshot](docs/screenshot.png) -->

## Features

- **Community Health Score (0-100)** — 7-factor score per repository: CONTRIBUTING.md, license, code of conduct, recent activity, stars, issue response time, and PR merge rate. Know if a repo actually welcomes contributors before you invest time.

- **AI Difficulty Estimation** — Two-tier system: fast rule-based keyword analysis first, falls back to GPT-4o-mini when confidence is low. A purple sparkle badge shows when AI was used — full transparency.

- **Personalized Recommendations** — Sign in with GitHub and IssueScout detects your languages and interests. The "For You" tab recommends issues matched to your stack with a match score.

- **Progressive Loading** — Issues appear instantly. Health scores and difficulty badges fill in asynchronously as enrichment completes. No loading spinners.

- **Smart Filtering** — 18 labels across 4 categories, language filter, difficulty filter, sort options, claimed/unclaimed toggle. URL state sync so you can share searches.

- **Bookmarks** — Save issues for later, archive completed ones. Full issue snapshots preserved even if the original changes.

- **Two-Level Caching** — Issue difficulty cached 24h. Repo health cached permanently with stale-while-revalidate at 48h. The more people use IssueScout, the faster it gets.

- **Per-User API Tokens** — Each user's GitHub OAuth token powers their searches (5,000 req/hr per user). No shared rate limit bottleneck. Tokens are revoked on sign-out.

- **Dark Mode** — System preference detection with manual toggle.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/turazashvili/issuescout.dev.git
cd issuescout.dev

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see below)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local` from `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_ID` | Yes | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret |
| `AUTH_SECRET` | Yes | NextAuth secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | App URL (`http://localhost:3000` for dev) |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `OPENAI_API_KEY` | Optional | OpenAI API key for GPT-4o-mini. Without it, difficulty estimation uses rule-based only. |
| `GITHUB_PAT` | Optional | GitHub PAT for unauthenticated fallback |

**GitHub OAuth App**: Create at [github.com/settings/applications/new](https://github.com/settings/applications/new) with callback URL `http://localhost:3000/api/auth/callback/github`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | NextAuth v5 (GitHub OAuth) |
| Database | MongoDB Atlas (Mongoose 9) |
| AI | OpenAI GPT-4o-mini |
| GitHub API | @octokit/graphql (GraphQL v4) |
| Deployment | Vercel |

## Architecture

```
Browser → Next.js App Router
            ├── /api/issues         → GitHub GraphQL (search)
            ├── /api/issues/enrich  → Two-level cache pipeline
            │                         L1: CachedIssue (difficulty, 24h TTL)
            │                         L2: IndexedRepo (health, permanent)
            ├── /api/recommendations → Parallel language searches + enrichment
            └── MongoDB Atlas
                  ├── users, cachedissues, indexedrepos
                  ├── searchlogs, bookmarks, surveyvotes
                  └── (6 collections)
```

**Key decisions:**
- Per-user OAuth tokens instead of a server PAT (scales linearly with users)
- Two-phase progressive loading (instant results, async enrichment)
- Repo-level health caching with stale-while-revalidate (first user pays, everyone else is instant)
- Rule-based AI with transparent GPT-4o-mini fallback (keeps costs minimal)

For detailed technical documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Health Score Algorithm

Each repository gets a 0-100 health score based on 7 factors:

| Factor | Points | What it measures |
|--------|--------|-----------------|
| CONTRIBUTING.md | 15 | Has a contributing guide |
| License | 10 | Has any license |
| Code of Conduct | 5 | Has a code of conduct |
| Recent Activity | 20 | Last commit within 30/90 days |
| Stars | 15 | Popularity signal |
| Response Time | 20 | Average time to first comment on issues |
| PR Merge Rate | 15 | Active maintenance signal |

A score of 70+ (green) means the repo actively welcomes contributors. Below 40 (red) means low activity.

## Supported By

IssueScout is supported by [Vexrail](https://vexrail.com?utm_source=github&utm_medium=readme&utm_campaign=issuescout).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

[MIT](LICENSE)
