# IssueScout

Open source issue discovery platform that helps developers find their first contribution. Surfaces GitHub "good first issue" labeled issues enriched with community health scores, AI difficulty estimation, and personalized recommendations.

**Repo**: https://github.com/turazashvili/issuescout.dev
**Domain**: issuescout.dev (pending Vercel deployment)
**Built for**: DEV Weekend Challenge ("Build for Your Community")

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [API Routes](#api-routes)
- [Services](#services)
- [Models (MongoDB)](#models-mongodb)
- [Components](#components)
- [Auth Flow](#auth-flow)
- [Search System](#search-system)
- [Recommendations System](#recommendations-system)
- [Health Score Algorithm](#health-score-algorithm)
- [Difficulty Estimation](#difficulty-estimation)
- [Caching Strategy](#caching-strategy)
- [Known Issues and Gotchas](#known-issues-and-gotchas)
- [Deployment](#deployment)

---

## Architecture Overview

```
User (Browser)
  |
  v
Next.js App Router (pages + API routes)
  |
  +-- NextAuth v5 (GitHub OAuth) --> GitHub OAuth App
  |
  +-- API Routes
  |     |
  |     +-- /api/issues ---------> GitHub GraphQL API (search)
  |     |                           + healthScore service (per-repo GraphQL)
  |     |                           + difficulty service (rule-based + OpenAI)
  |     |                           + CachedIssue (MongoDB, 24h TTL)
  |     |                           + SearchLog (MongoDB, permanent)
  |     |
  |     +-- /api/recommendations -> GitHub GraphQL API (per-language search)
  |     |                           + healthScore + difficulty enrichment
  |     |                           + match score calculation
  |     |
  |     +-- /api/issues/bookmark -> Bookmark collection (MongoDB, permanent)
  |     +-- /api/onboarding ------> fetchUserProfile (GitHub GraphQL)
  |     +-- /api/user/preferences -> User collection (MongoDB)
  |
  +-- MongoDB Atlas
        +-- users (preferences, onboarding state)
        +-- cachedissues (24h TTL, health + difficulty cache)
        +-- searchlogs (permanent, analytics)
        +-- bookmarks (permanent, issue snapshots)
```

**Key design decision**: Each authenticated user's GitHub OAuth token is used for API requests (5K req/hr per user) instead of a single server token. Unauthenticated users fall back to `GITHUB_PAT` env var.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york style) |
| Auth | NextAuth v5 beta (GitHub OAuth) |
| Database | MongoDB Atlas (Mongoose 9.x) |
| AI | OpenAI GPT-4o-mini (difficulty estimation fallback) |
| GitHub API | @octokit/graphql (GraphQL v4) |
| Icons | lucide-react |
| UI Primitives | Radix UI (via shadcn) |
| Deployment | Vercel (planned) |

---

## Getting Started

```bash
# Clone
git clone https://github.com/turazashvili/issuescout.dev.git
cd first-issue-finder

# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables section)

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

---

## Environment Variables

Create `.env.local` from `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_ID` | Yes | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret |
| `AUTH_SECRET` | Yes | NextAuth secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | App base URL (`http://localhost:3000` for dev) |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `OPENAI_API_KEY` | For AI | OpenAI API key for GPT-4o-mini. Without it, difficulty estimation uses rule-based only |
| `GITHUB_PAT` | Optional | GitHub PAT for unauthenticated fallback requests |

**GitHub OAuth App setup**: Create at https://github.com/settings/applications/new
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`
- Scopes needed: `read:user`, `user:email` (configured in auth.ts)

**Important**: The `.env.local` is gitignored. Never commit real credentials.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, providers, header)
│   ├── globals.css             # Tailwind v4 theme, dark mode, prose styles
│   ├── page.tsx                # Landing page (/)
│   ├── explore/page.tsx        # Issue search + recommendations (/explore)
│   ├── issue/[id]/page.tsx     # Issue detail view (/issue/owner__repo__number)
│   ├── bookmarks/page.tsx      # Saved & archived bookmarks (/bookmarks)
│   ├── onboarding/page.tsx     # 2-step onboarding wizard (/onboarding)
│   ├── settings/page.tsx       # Edit preferences (/settings)
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handlers
│       ├── issues/             # Search issues (GET)
│       ├── issues/[id]/        # Single issue detail (GET)
│       ├── issues/bookmark/    # Bookmark CRUD (GET, POST)
│       ├── onboarding/         # Profile detection + save prefs (GET, POST)
│       ├── recommendations/    # Personalized issues (GET)
│       └── user/preferences/   # User preferences CRUD (GET, PUT)
├── components/
│   ├── Header.tsx              # Sticky nav with auth, theme toggle
│   ├── FilterBar.tsx           # Search filters (language, difficulty, labels, sort)
│   ├── IssueCard.tsx           # Issue card with stats, badges, bookmarks
│   ├── IssueCardSkeleton.tsx   # Loading skeleton
│   ├── DifficultyBadge.tsx     # Easy/Medium/Hard badge with AI indicator
│   ├── HealthScoreBadge.tsx    # 0-100 health score badge
│   ├── ThemeToggle.tsx         # Dark/light mode toggle
│   ├── SessionProvider.tsx     # NextAuth session wrapper
│   └── ui/                     # 16 shadcn/ui components
├── lib/
│   ├── auth.ts                 # NextAuth v5 config, JWT callbacks, user upsert
│   ├── mongodb.ts              # Mongoose singleton connection
│   └── utils.ts                # cn() utility for classnames
├── models/
│   ├── User.ts                 # User preferences + onboarding state
│   ├── CachedIssue.ts          # 24h TTL cache for health + difficulty
│   ├── SearchLog.ts            # Permanent search analytics
│   └── Bookmark.ts             # Saved issue snapshots
├── services/
│   ├── github.ts               # GitHub GraphQL queries + search builder
│   ├── healthScore.ts          # 7-factor repo health calculator
│   └── difficulty.ts           # Rule-based + GPT-4o-mini estimator
└── types/
    ├── index.ts                # All app types (GitHubIssue, EnrichedIssue, etc.)
    └── next-auth.d.ts          # NextAuth type augmentations
```

---

## Pages

### `/` - Landing Page
Client component. Hero section with search bar, language quick-filters (JS, TS, Python, Go, Rust, Java, Ruby, C++), feature cards, how-it-works section, stats strip, footer. If authenticated user hasn't completed onboarding, redirects to `/onboarding`.

### `/explore` - Explore Issues
Client component wrapped in `<Suspense>`. Two tabs:

**Search tab**: Full `<FilterBar>` with text search, language dropdown (16 languages), difficulty filter, label multi-select (18 labels in 4 groups), sort (6 options), claimed/unclaimed toggle. Results from `/api/issues` with server-side pagination ("Load More"). URL state sync with debounce (300ms for query, instant for dropdowns). Only syncs to URL when search tab is active.

**For You tab** (authenticated only): Shows user's preference tags (clickable language pills + topic badges). Lightweight inline filters (search input + difficulty dropdown). Fetches all 60 recommendations at once from `/api/recommendations`, client-side pagination showing 20 at a time with "Load More".

### `/issue/[id]` - Issue Detail
Client component. URL param format: `owner__repo__number`. Shows full issue body (rendered from `bodyHTML` with prose styling), health score badge, difficulty badge, labels. Sidebar with repo info, community health report breakdown, and "Getting Started" guide.

### `/bookmarks` - Saved Issues
Client component. Requires auth. Two tabs: Saved (active bookmarks) and Archived. Each shows a grid of `<IssueCard>` with bookmark/archive action buttons.

### `/onboarding` - Onboarding Wizard
Client component. Requires auth. Two steps:
1. **Languages**: Auto-detected from GitHub profile (own repos weighted 2x, starred repos 1x) + popular languages list (21 options) + custom input.
2. **Frameworks**: Auto-detected topics from starred repos + popular frameworks list (35 options) + custom input.

Saves to `User.preferredLanguages` and `User.preferredFrameworks`. Sets `onboardingCompleted: true`. Redirects to `/explore?tab=recommended` after completion.

### `/settings` - Edit Preferences
Client component. Requires auth. Same language/framework selection UI as onboarding but editable at any time. "Re-scan GitHub" button to refresh auto-detected data.

---

## API Routes

### `GET /api/issues`

Main search endpoint. Orchestrates GitHub search, enrichment, caching, and logging.

**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | `""` | Free-text search |
| `language` | string | `""` | Programming language |
| `difficulty` | `easy\|medium\|hard\|all` | `"all"` | Difficulty filter (post-enrichment) |
| `sort` | string | `"newest"` | Sort order |
| `after` | string | `null` | Pagination cursor |
| `limit` | number | `60` | Results per page (max 100) |
| `labels` | comma-separated | `""` | Label filter (OR logic) |
| `showClaimed` | `"true"\|"false"` | `"false"` | Include assigned/linked-PR issues |

**Response**:
```json
{
  "issues": [EnrichedIssue],
  "totalCount": 1234,
  "pagination": {
    "hasNextPage": true,
    "endCursor": "Y3Vyc29yOjMw",
    "totalCount": 1234
  }
}
```

**Over-fetch strategy for difficulty filtering**: When difficulty is not "all", the API over-fetches because difficulty is computed post-fetch by our estimator, not by GitHub.
- Easy (has comment-count proxy `comments:0..5`): ~80% hit rate, up to 3 rounds x 60 issues
- Medium/Hard (no proxy): ~20-40% hit rate, up to 5 rounds x 60 issues, enriches up to 5x desired count

### `GET /api/issues/[id]`

Single issue detail. URL param format: `owner__repo__number` (double-underscore separated).

Returns full issue with `bodyHTML`, participants, timeline items, plus health score and difficulty.

### `GET /POST /api/issues/bookmark`

**GET**: Fetch user's bookmarks. Query param `status`: `active|archived|all` (default `active`).

**POST**: Modify bookmarks. Body: `{ issueId, action: "add"|"remove"|"archive"|"unarchive", issueData? }`. `issueData` required for "add" — stores full enriched issue snapshot.

### `GET /POST /api/onboarding`

**GET**: Returns auto-detected languages/topics from GitHub profile + any saved preferences.

**POST**: Saves onboarding preferences. Body: `{ languages: string[], frameworks: string[] }`.

### `GET /api/recommendations`

Returns up to 60 personalized issues. Auth required. See [Recommendations System](#recommendations-system) for details.

### `GET /PUT /api/user/preferences`

**GET**: Returns current user preferences and onboarding status.

**PUT**: Updates preferences. Body: `{ languages?: string[], frameworks?: string[] }`. Only updates provided fields.

---

## Services

### `github.ts` - GitHub GraphQL Service

Three GraphQL queries:
- `SEARCH_ISSUES_QUERY`: Searches issues with reactions, repo metadata, labels, comments
- `REPO_HEALTH_QUERY`: Fetches repo health signals (CONTRIBUTING.md, license, CoC, activity, PRs)
- `USER_PROFILE_QUERY`: Fetches user's repos + starred repos for language/topic detection

**Key functions**:

`searchIssues(query, language, first, after, userToken, options)` - Builds a GitHub search query string with these qualifiers:
1. Base: `state:open is:issue is:public archived:false` (always)
2. Availability: `no:assignee -linked:pr` (default, toggleable)
3. Labels: OR-logic `label:"l1","l2"` (defaults to good-first-issue variants)
4. User text query (prepended)
5. Language filter
6. Difficulty proxy: easy -> `comments:0..5`, medium/hard -> no proxy
7. Sort qualifier

`fetchRepoHealth(owner, name, userToken)` - Fetches repo metadata for health scoring.

`fetchUserProfile(login, userToken)` - Fetches user's top 20 repos (by stars) + last 30 starred repos. Returns top 10 languages (own repos weighted 2x) and top 10 topics.

### `healthScore.ts` - Health Score Calculator

See [Health Score Algorithm](#health-score-algorithm).

### `difficulty.ts` - Difficulty Estimator

See [Difficulty Estimation](#difficulty-estimation).

---

## Models (MongoDB)

### User

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `githubId` | String (unique) | - | GitHub user ID |
| `login` | String | - | GitHub username |
| `name` | String | `""` | Display name |
| `avatarUrl` | String | `""` | Avatar URL |
| `email` | String | `""` | Email |
| `languages` | String[] | `[]` | Auto-detected from GitHub |
| `frameworks` | String[] | `[]` | Auto-detected |
| `topics` | String[] | `[]` | Auto-detected from starred repos |
| `preferredLanguages` | String[] | `[]` | User-curated (onboarding + settings) |
| `preferredFrameworks` | String[] | `[]` | User-curated |
| `onboardingCompleted` | Boolean | `false` | Onboarding status |

Timestamps enabled (`createdAt`, `updatedAt`).

### CachedIssue (24h TTL)

Caches health score + difficulty per issue. **Does not cache the issue data itself** — issue data is always fresh from GitHub. The `data` field stores a blob but is only used as a fallback reference.

| Field | Type | Default | TTL |
|-------|------|---------|-----|
| `issueId` | String (unique) | - | - |
| `data` | Mixed | - | - |
| `healthScore` | Number | `0` | - |
| `healthDetails` | Mixed | `{}` | - |
| `difficulty` | `easy\|medium\|hard\|unknown` | `"unknown"` | - |
| `difficultyReason` | String | `""` | - |
| `difficultyUsedAI` | Boolean | `false` | - |
| `repoOwner` | String | `""` | - |
| `repoName` | String | `""` | - |
| `language` | String | `""` | - |
| `cachedAt` | Date | `Date.now` | **86400s (24h)** |

Indexes: `issueId` (unique), `language`, `healthScore` (desc), `cachedAt` (TTL).

### SearchLog (permanent, no TTL)

Every search is logged permanently for analytics.

| Field | Type | Default |
|-------|------|---------|
| `userId` | String | `null` |
| `userLogin` | String | `null` |
| `query` | String | `""` |
| `programmingLanguage` | String | `""` |
| `difficulty` | String | `"all"` |
| `sort` | String | `"newest"` |
| `resultCount` | Number | `0` |
| `timestamp` | Date | `Date.now` |

Indexes: `timestamp` (desc), `userId + timestamp`, `programmingLanguage`, `query` (text index).

**Note**: Field is `programmingLanguage` not `language` — MongoDB reserves `language` for text index language override.

### Bookmark (permanent, no TTL)

Separate collection (not embedded in User). Stores full `issueData` snapshot at bookmark time.

| Field | Type | Default |
|-------|------|---------|
| `userId` | String | - |
| `issueId` | String | - |
| `issueData` | Mixed | - |
| `archived` | Boolean | `false` |
| `savedAt` | Date | `Date.now` |
| `archivedAt` | Date | `null` |

Indexes: `userId + archived`, `userId + issueId` (unique compound).

---

## Components

### Custom Components

| Component | File | Key Props | Description |
|-----------|------|-----------|-------------|
| `Header` | `Header.tsx` | none | Sticky nav bar. Logo, links (Explore, For You, Saved), ThemeToggle, user dropdown (Saved, Preferences, Sign Out) or sign-in button |
| `FilterBar` | `FilterBar.tsx` | query, language, difficulty, sort, labels, showClaimed, callbacks, totalCount | Full search control panel. Text input, language select (16 langs), difficulty select, label multi-select popover (4 groups, 18 labels), sort select (6 options), claimed toggle, clear button, base filter pills |
| `IssueCard` | `IssueCard.tsx` | issue, onBookmarkToggle?, onArchiveToggle?, showArchiveButton?, showUnarchiveButton? | Card with repo info, title (links to GitHub), body preview (200 chars), labels (max 4), HealthScoreBadge, DifficultyBadge, footer stats (stars, forks, comments, reactions, time) with tooltips, bookmark/archive buttons, match score percentage |
| `IssueCardSkeleton` | `IssueCardSkeleton.tsx` | none | Loading placeholder |
| `DifficultyBadge` | `DifficultyBadge.tsx` | difficulty, reason?, usedAI?, size? | Color-coded badge (emerald/amber/red). Shows numeric icon (1/2/3). Purple sparkle if AI was used. Tooltip with reason |
| `HealthScoreBadge` | `HealthScoreBadge.tsx` | score, details?, size? | Score badge with shield icon. >=70 emerald "Welcoming", >=40 amber "Moderate", <40 red "Low Activity". Tooltip with breakdown |
| `ThemeToggle` | `ThemeToggle.tsx` | none | Toggles `.dark` class on `<html>`. Persists to `localStorage("theme")`. Respects system preference on first visit |
| `SessionProvider` | `SessionProvider.tsx` | children | NextAuth `<SessionProvider>` wrapper |

### shadcn/ui Components (16)

Located in `src/components/ui/`: avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, input, popover, select, separator, sheet, skeleton, tabs, tooltip.

**FilterBar exports**: `DEFAULT_LABELS = ["good first issue", "good-first-issue"]`

---

## Auth Flow

1. User clicks "Sign in with GitHub" -> NextAuth redirects to GitHub OAuth
2. User authorizes -> GitHub redirects back with code
3. NextAuth exchanges code for access token
4. **JWT callback** fires:
   - Stores `access_token`, `githubId`, `login`, `avatarUrl` on JWT
   - **Upserts user in MongoDB** (creates on first sign-in, updates login/name/avatar on subsequent sign-ins)
   - Uses `$setOnInsert` for `onboardingCompleted: false` and empty preference arrays (doesn't overwrite existing preferences)
5. **Session callback** copies JWT fields to the client-visible session
6. Client checks `/api/user/preferences` — if `onboardingCompleted === false`, redirects to `/onboarding`

**Why not trust JWT for onboarding status**: JWT tokens are static — `onboardingCompleted` stored in JWT at sign-in becomes stale after onboarding completes mid-session. The app checks the DB via `/api/user/preferences` instead.

**OAuth scopes**: `read:user`, `user:email`

**Custom pages**: `signIn: "/"` (home page acts as sign-in page)

---

## Search System

### Query Construction

Every search query starts with base qualifiers that are **always applied**:

```
state:open is:issue is:public archived:false
```

Then conditionally adds:
- `no:assignee` — default on, toggle off with "Show Claimed"
- `-linked:pr` — default on, toggle off with "Show Claimed"
- `label:"good first issue","good-first-issue"` — default labels, user can customize via multi-select
- User's free-text query (prepended)
- `language:X` — from language dropdown
- `comments:0..5` — only when difficulty=easy (heuristic proxy)
- `sort:X` — maps to GitHub sort qualifiers

### Label System

18 labels organized in 4 groups:

**Beginner-Friendly** (default: first two selected):
good first issue, good-first-issue, beginner, beginner-friendly, easy, starter, first-timers-only, help wanted

**Contribution Type**:
documentation, bug, enhancement, feature

**Issue Type**:
frontend, backend, ui, ux, testing

**Events**:
hacktoberfest

Labels use **OR logic** (`label:"a","b","c"` matches issues with ANY of those labels). Empty selection = no label filter (searches all issues).

### Sort Options

| UI Label | GitHub Qualifier | Client-side? |
|----------|-----------------|-------------|
| Newest First | default (sort:created-desc) | No |
| Oldest First | sort:created-asc | No |
| Most Discussed | sort:comments-desc | No |
| Most Reactions | sort:reactions-desc | No |
| Recently Updated | sort:updated-desc | No |
| Best Community | - | **Yes** (sorts by healthScore) |

### Over-fetch Strategy

Difficulty is computed post-fetch by our estimator, not by GitHub. When a difficulty filter is active, the API over-fetches to ensure enough results survive filtering:

- **Easy** (with `comments:0..5` proxy): ~80% hit rate. Up to 3 rounds x 60 issues fetched.
- **Medium/Hard** (no proxy): ~20-40% hit rate. Up to 5 rounds x 60 issues fetched, enriches up to 5x desired count.

The `comments:>5` proxy for "hard" was removed because high-comment issues are usually just popular, not necessarily hard.

### URL Sync

Search tab filters sync to URL query params with debounce:
- `q` — 300ms debounce
- `language`, `difficulty`, `sort`, `labels`, `showClaimed` — instant
- `tab` — only set when not "search" (default)

URL sync is **tab-aware**: only syncs search filters when on search tab. Recommended tab only sets `tab=recommended`.

---

## Recommendations System

### Flow

1. **Determine preferences**: If onboarding completed, use `user.preferredLanguages` (up to 5) + `user.preferredFrameworks`. Otherwise, fallback to `fetchUserProfile()` (top 3 languages from GitHub).

2. **Fetch issues**: For each of the top 3 languages, call `searchIssues("", language, 30)` with default qualifiers. That's up to **90 raw issues** total.

3. **Enrich each issue**: Health score (GraphQL call per repo) + difficulty estimation (rule-based + optional GPT-4o-mini). This is the expensive part — 90 issues x 2 enrichment calls each.

4. **Calculate match score** (0-100 per issue):

| Factor | Points | Logic |
|--------|--------|-------|
| Language rank | 20-50 | 1st language = 50, 2nd = 35, 3rd = 20 |
| Health contribution | 0-30 | `healthScore * 0.3` |
| Difficulty bonus | 0-10 | Easy = 10, Medium = 5, Hard = 0 |
| Framework match | 0-10 | +10 if repo description contains any user framework |

5. **Sort by match score** descending, deduplicate by issue ID, return top **60**.

### Client-side Display

All 60 issues loaded at once. Client-side:
- Shows 20 at a time with "Load More" (+20 each click)
- Text search filter (title/body/repo/labels)
- Clickable language preference pills (filter by language)
- Difficulty dropdown
- No full FilterBar — recommendations are preference-driven, not search-driven

### Performance Note

The recommendations API does **not** use the `CachedIssue` cache. Every recommendation fetch re-enriches from scratch. This is a known limitation — each call makes up to 90 `calculateHealthScore` GraphQL calls + 90 `estimateDifficulty` calls.

---

## Health Score Algorithm

7-factor score from 0-100. Calculated per repository via a dedicated GraphQL query.

| Factor | Max Points | Scoring |
|--------|-----------|---------|
| CONTRIBUTING.md | 15 | Checks both `CONTRIBUTING.md` and `contributing.md` |
| License | 10 | Any license present |
| Code of Conduct | 5 | Has code of conduct |
| Recent Activity | 20 | Last commit <30d = 20, <90d = 10, else 0 |
| Star Count | 15 | >=1000 = 15, >=100 = 12, >=10 = 8, >=1 = 4 |
| Response Time | 20 | Avg first-comment time on 5 recent issues. <24h = 20, <72h = 15, <168h = 10, else 5 |
| PR Merge Rate | 15 | Merged PRs count. >=100 = 15, >=50 = 12, >=10 = 8, >=1 = 4 |

**Community size label**: `large` (stars>=1000 or forks>=100), `medium` (stars>=100 or forks>=20), `small` (else).

**Response time**: Calculated from the 5 most recent open issues. For each, checks if there's a first comment, computes the time delta from issue creation to first comment, averages across issues that have comments.

---

## Difficulty Estimation

Two-tier system:

### Tier 1: Rule-based (instant, free)

Scans issue title, body text, and labels for keyword signals:

- **Easy signals** (18 keywords): typo, documentation, docs, readme, spelling, grammar, first-timers-only, good-first-issue, beginner, easy, simple, trivial, update link, add comment, rename, translation, i18n, l10n
- **Medium signals** (13): feature, enhancement, refactor, component, test, testing, bug, fix, improve, add support, implement, new, create
- **Hard signals** (12): architecture, security, vulnerability, performance, optimization, breaking change, migration, database, api redesign, complex, critical, regression

Additional factors:
- Body length: >2000 chars adds +1 hard, <300 chars adds +1 easy
- Label overrides: `first-timers-only`, `good first issue`, `beginner` add +3 to easy

**Confidence** = max category score / total signals found.

### Tier 2: GPT-4o-mini (if confidence < 0.8)

Sends title + body (first 500 chars) + labels to GPT-4o-mini with `temperature: 0.1`, `max_tokens: 100`, `response_format: json_object`. Returns `{ difficulty, reason }`.

Falls back to rule-based result if:
- `OPENAI_API_KEY` is missing or is the placeholder value
- API call fails

The `usedAI` flag is returned and displayed as a purple sparkle icon on `DifficultyBadge`.

---

## Caching Strategy

| Collection | TTL | What's Cached | Purpose |
|-----------|-----|---------------|---------|
| `CachedIssue` | 24 hours | Health score + difficulty per issue | Avoid re-computing expensive enrichment for the same issue within a day |
| `SearchLog` | None (permanent) | Every search query + filters + result count | Analytics / usage tracking |
| `Bookmark` | None (permanent) | Full enriched issue snapshot at bookmark time | User's saved issues persist even if the GitHub issue changes |
| `User` | None (permanent) | Preferences, onboarding state, detected languages | User profile data |

**Important**: The `CachedIssue` cache is only used by `/api/issues` (search endpoint). The `/api/recommendations` endpoint does NOT use it — it re-enriches every time.

**MongoDB connection**: Singleton pattern with `global.mongooseCache` to prevent multiple connections during Next.js hot reloading in development.

---

## Known Issues and Gotchas

### GitHub API

- `@octokit/graphql` reserves `query` as a parameter name — GraphQL variable must be named `$searchQuery`, not `$query`.
- `RepositoryOrderField` uses `STARGAZERS` not `STARGAZER_COUNT`.
- **GitHub issue search does NOT support `stars:` or `forks:` qualifiers** — those only work for `type:REPOSITORY` search. Stars/forks filters are commented out with `// TODO: Re-enable` markers.
- **GitHub issue search sort options**: `sort:created`, `sort:comments`, `sort:updated`, `sort:reactions`, `sort:interactions`. Does NOT support `sort:stars` or `sort:forks`.
- GitHub search labels use OR logic: `label:"a","b","c"` matches ANY.
- GitHub GraphQL supports max 100 results per request (`first: 100`).

### MongoDB

- Field named `language` conflicts with MongoDB text indexes (reserved for text search language override). SearchLog uses `programmingLanguage` instead.
- Mongoose `{ new: true }` is deprecated — use `{ returnDocument: "after" }`.

### NextAuth

- JWT tokens are static — `onboardingCompleted` in JWT becomes stale after onboarding completes. App checks DB via API instead of trusting JWT.
- Using NextAuth v5 beta (`5.0.0-beta.30`).

### UI

- Radix UI `Select` with `position="item-aligned"` (default) hijacks page scroll. All `SelectContent` uses `position="popper"` instead.
- "Load More" can return duplicate issues from GitHub pagination — deduplicated by `id` when appending.
- Empty `labels` array vs undefined has different semantics: `undefined` = use defaults, `[]` = user deselected all, skip label qualifier.

### Security

- User search text goes directly into GitHub query as full-text search with no sanitization. Minor risk of qualifier injection (`no:`, `repo:`, etc.) but low severity since it only affects the user's own search.

### Performance

- Recommendations API makes up to 90 health-score GraphQL calls + 90 difficulty calls per request with no caching.
- Default fetch is 60 issues per page. Over-fetch for difficulty can go up to 300 issues (5 rounds x 60) for medium/hard filters.

---

## Deployment

### Vercel (planned)

1. Connect GitHub repo to Vercel
2. Set environment variables in Vercel dashboard (all from `.env.example`)
3. Update GitHub OAuth App callback URL to `https://issuescout.dev/api/auth/callback/github`
4. Update `NEXTAUTH_URL` to `https://issuescout.dev`
5. Deploy

### Build

```bash
npm run build    # Next.js production build with Turbopack
npm start        # Start production server
npm run lint     # ESLint
```

Build output uses static generation where possible (landing, explore, bookmarks, onboarding, settings pages are pre-rendered as static shells) and dynamic server rendering for API routes and the issue detail page.
