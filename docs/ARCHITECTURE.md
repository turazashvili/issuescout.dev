# Architecture

Detailed technical documentation for IssueScout internals. Supported by [Vexrail](https://vexrail.com?utm_source=github&utm_medium=architecture_docs&utm_campaign=issuescout).

## Table of Contents

- [Architecture Overview](#architecture-overview)
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
- [Analytics](#analytics)
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
  |     |                           + IndexedRepo (MongoDB, permanent)
  |     |                           + SearchLog (MongoDB, permanent)
  |     |
  |     +-- /api/issues/enrich ---> Two-level cache enrichment pipeline
  |     |                           L1: CachedIssue (difficulty, 24h TTL)
  |     |                           L2: IndexedRepo (health, permanent, stale-while-revalidate 48h)
  |     |
  |     +-- /api/recommendations -> GitHub GraphQL API (per-language search)
  |     |                           + parallel language searches (Promise.all)
  |     |                           + two-level cache enrichment
  |     |                           + match score calculation
  |     |
  |     +-- /api/issues/bookmark -> Bookmark collection (MongoDB, permanent)
  |     +-- /api/onboarding ------> fetchUserProfile (GitHub GraphQL)
  |     +-- /api/user/preferences -> User collection (MongoDB)
  |     +-- /api/stats -----------> IndexedRepo.countDocuments()
  |     +-- /api/survey ----------> SurveyVote collection (MongoDB)
  |
  +-- MongoDB Atlas
        +-- users (preferences, onboarding state)
        +-- cachedissues (24h TTL, difficulty cache)
        +-- indexedrepos (permanent, repo health cache)
        +-- searchlogs (permanent, analytics)
        +-- bookmarks (permanent, issue snapshots)
        +-- surveyvotes (permanent, landing page survey)
```

**Key design decisions**:
- Each authenticated user's GitHub OAuth token is used for API requests (5K req/hr per user) instead of a single server token
- Two-phase progressive loading: issues appear instantly, enrichment fills in asynchronously
- Two-level caching: issue difficulty (24h TTL) + repo health (permanent with stale-while-revalidate at 48h)
- GitHub token is revoked server-side on sign-out

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
│       ├── issues/enrich/      # Batch enrichment (POST)
│       ├── issues/bookmark/    # Bookmark CRUD (GET, POST)
│       ├── onboarding/         # Profile detection + save prefs (GET, POST)
│       ├── recommendations/    # Personalized issues (GET)
│       ├── stats/              # IndexedRepo count (GET)
│       ├── survey/             # Landing page survey (GET, POST)
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
│   ├── auth.ts                 # NextAuth v5 config, JWT callbacks, user upsert, token revocation
│   ├── mongodb.ts              # Mongoose singleton connection
│   └── utils.ts                # cn() utility for classnames
├── models/
│   ├── User.ts                 # User preferences + onboarding state
│   ├── CachedIssue.ts          # 24h TTL cache for difficulty
│   ├── IndexedRepo.ts          # Permanent repo health cache (stale-while-revalidate 48h)
│   ├── SearchLog.ts            # Permanent search analytics
│   ├── Bookmark.ts             # Saved issue snapshots
│   └── SurveyVote.ts           # Landing page survey votes
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
Client component. Hero section with search bar, language quick-filters (JS, TS, Python, Go, Rust, Java, Ruby, C++), feature cards, how-it-works section, stats strip with animated repos-indexed counter, open source survey banner, footer. If authenticated user hasn't completed onboarding, redirects to `/onboarding`.

### `/explore` - Explore Issues
Client component wrapped in `<Suspense>`. Requires authentication (shows sign-in prompt if unauthenticated). Two tabs:

**Search tab**: Full `<FilterBar>` with text search, language dropdown (16 languages), difficulty filter, label multi-select (18 labels in 4 groups), sort (6 options), claimed/unclaimed toggle. Results from `/api/issues` with server-side pagination ("Load More"). URL state sync with debounce (300ms for query, instant for dropdowns). Two-phase progressive loading: issues render immediately, enrichment badges fill in asynchronously.

**For You tab** (authenticated only): Shows user's preference tags (clickable language pills + topic badges). Lightweight inline filters (search input + difficulty dropdown). Fetches all 60 recommendations at once from `/api/recommendations`, client-side pagination showing 20 at a time with "Load More".

### `/issue/[id]` - Issue Detail
Client component. URL param format: `owner__repo__number`. Shows full issue body (rendered from `bodyHTML` with prose styling), health score badge, difficulty badge, labels. Sidebar with repo info, community health report breakdown, and "Getting Started" guide. Uses IndexedRepo for health (blocking refresh if stale/missing).

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

Main search endpoint. Returns raw GitHub results without enrichment (fast path).

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

### `POST /api/issues/enrich`

Batch enrichment endpoint. Two-level cache lookup:
- **L1**: Bulk `CachedIssue` check for difficulty
- **L2**: Bulk `IndexedRepo` check for health scores
- Missing repos get blocking `calculateHealthScore()` + stored in IndexedRepo
- Stale repos (>48h) return cached data immediately + fire-and-forget background refresh

### `GET /api/issues/[id]`

Single issue detail. URL param format: `owner__repo__number`. Returns full issue with `bodyHTML`, participants, timeline items, plus health score and difficulty. Uses IndexedRepo with blocking refresh if stale.

### `GET /POST /api/issues/bookmark`

**GET**: Fetch user's bookmarks. Query param `status`: `active|archived|all` (default `active`).

**POST**: Modify bookmarks. Body: `{ issueId, action: "add"|"remove"|"archive"|"unarchive", issueData? }`. `issueData` required for "add" — stores full enriched issue snapshot.

### `GET /POST /api/onboarding`

**GET**: Returns auto-detected languages/topics from GitHub profile + any saved preferences.

**POST**: Saves onboarding preferences. Body: `{ languages: string[], frameworks: string[] }`.

### `GET /api/recommendations`

Returns up to 60 personalized issues. Auth required. Parallel language searches via `Promise.all`. Two-level cache enrichment. See [Recommendations System](#recommendations-system).

### `GET /PUT /api/user/preferences`

**GET**: Returns current user preferences and onboarding status.

**PUT**: Updates preferences. Body: `{ languages?: string[], frameworks?: string[] }`.

### `GET /api/stats`

Returns `{ reposIndexed: number }` — count of documents in the IndexedRepo collection.

### `GET /POST /api/survey`

**GET**: Returns `{ yes: number, no: number }` vote counts.

**POST**: Records a vote. Body: `{ vote: "yes"|"no" }`.

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

### CachedIssue (24h TTL)

Caches difficulty per issue. Health scores live in IndexedRepo.

| Field | Type | TTL |
|-------|------|-----|
| `issueId` | String (unique) | - |
| `difficulty` | `easy\|medium\|hard\|unknown` | - |
| `difficultyReason` | String | - |
| `difficultyUsedAI` | Boolean | - |
| `repoFullName` | String | - |
| `language` | String | - |
| `cachedAt` | Date | **86400s (24h)** |

### IndexedRepo (permanent, stale-while-revalidate 48h)

Permanent repo health cache. No TTL. Data older than 48h is returned immediately but triggers a background refresh.

| Field | Type | Notes |
|-------|------|-------|
| `fullName` | String (unique) | `owner/name` |
| `owner` | String | - |
| `name` | String | - |
| `healthScore` | Number | 0-100 |
| `healthDetails` | Mixed | Full breakdown |
| `stargazerCount` | Number | - |
| `forkCount` | Number | - |
| `primaryLanguage` | String | - |
| `description` | String | - |
| `lastEnrichedAt` | Date | Used for stale check |

Indexes: `primaryLanguage+healthScore`, `lastEnrichedAt`.

### SearchLog (permanent)

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

**Note**: Field is `programmingLanguage` not `language` — MongoDB reserves `language` for text index language override.

### Bookmark (permanent)

| Field | Type | Default |
|-------|------|---------|
| `userId` | String | - |
| `issueId` | String | - |
| `issueData` | Mixed | Full enriched issue snapshot |
| `archived` | Boolean | `false` |
| `savedAt` | Date | `Date.now` |
| `archivedAt` | Date | `null` |

### SurveyVote (permanent)

| Field | Type |
|-------|------|
| `question` | String (indexed) |
| `vote` | `"yes"\|"no"` |

---

## Components

### Custom Components

| Component | Key Props | Description |
|-----------|-----------|-------------|
| `Header` | none | Sticky nav bar. Logo, links, ThemeToggle, user dropdown or sign-in button. Clears cookies and revokes token on sign-out. |
| `FilterBar` | query, language, difficulty, sort, labels, showClaimed, callbacks | Full search control panel. Text input, language select, difficulty select, label multi-select popover (4 groups, 18 labels), sort select, claimed toggle. |
| `IssueCard` | issue, enriching?, onBookmarkToggle? | Card with repo info, title, body preview, labels, HealthScoreBadge, DifficultyBadge, footer stats with tooltips, bookmark buttons, match score. Skeleton badges while enriching. |
| `DifficultyBadge` | difficulty, reason?, usedAI? | Color-coded badge. Purple sparkle if AI was used. |
| `HealthScoreBadge` | score, details? | Score badge with breakdown tooltip. |
| `ThemeToggle` | none | Dark/light mode toggle. Persists to localStorage. |
| `GoogleAnalytics` | none | Conditionally loads GA4 gtag.js scripts. Only renders after cookie consent is accepted. Listens for `cookie-consent-update` custom event. |
| `CookieConsent` | none | Fixed bottom banner asking user to accept/decline cookies. Persists choice to `localStorage` (`cookie-consent` key). Dispatches `cookie-consent-update` event on accept. |

### shadcn/ui Components (16)

Located in `src/components/ui/`: avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, input, popover, select, separator, sheet, skeleton, tabs, tooltip.

---

## Auth Flow

1. User clicks "Sign in with GitHub" -> NextAuth redirects to GitHub OAuth
2. User authorizes -> GitHub redirects back with code
3. NextAuth exchanges code for access token
4. **JWT callback** fires:
   - Stores `access_token`, `githubId`, `login`, `avatarUrl` on JWT
   - **Upserts user in MongoDB** (creates on first sign-in, updates on subsequent)
   - Uses `$setOnInsert` for defaults (doesn't overwrite existing preferences)
5. **Session callback** copies JWT fields to the client-visible session
6. Client checks `/api/user/preferences` — if `onboardingCompleted === false`, redirects to `/onboarding`
7. **On sign-out**: GitHub OAuth token is revoked server-side via `DELETE /applications/{client_id}/token`. Utility cookies are cleared client-side.

**Why not trust JWT for onboarding status**: JWT tokens are static — `onboardingCompleted` stored in JWT at sign-in becomes stale after onboarding completes mid-session.

**OAuth scopes**: `read:user`, `user:email`

---

## Search System

### Query Construction

Every search query starts with base qualifiers:
```
state:open is:issue is:public archived:false
```

Then conditionally adds:
- `no:assignee -linked:pr` — default on, toggle off with "Show Claimed"
- `label:"good first issue","good-first-issue"` — default labels, customizable via multi-select
- User's free-text query
- `language:X` — from language dropdown
- `comments:0..5` — only when difficulty=easy (heuristic proxy)
- `sort:X` — maps to GitHub sort qualifiers

### Label System

18 labels organized in 4 groups:

**Beginner-Friendly** (default: first two selected):
good first issue, good-first-issue, beginner, beginner-friendly, easy, starter, first-timers-only, help wanted

**Contribution Type**: documentation, bug, enhancement, feature

**Issue Type**: frontend, backend, ui, ux, testing

**Events**: hacktoberfest

Labels use **OR logic**. Empty selection = no label filter.

### Sort Options

| UI Label | GitHub Qualifier | Client-side? |
|----------|-----------------|-------------|
| Newest First | sort:created-desc | No |
| Oldest First | sort:created-asc | No |
| Most Discussed | sort:comments-desc | No |
| Most Reactions | sort:reactions-desc | No |
| Recently Updated | sort:updated-desc | No |
| Best Community | - | **Yes** (sorts by healthScore) |

### Over-fetch Strategy

Difficulty is computed post-fetch. When a difficulty filter is active, the API over-fetches:
- **Easy** (with `comments:0..5` proxy): ~80% hit rate, up to 3 rounds x 60 issues
- **Medium/Hard** (no proxy): ~20-40% hit rate, up to 5 rounds x 60 issues

---

## Recommendations System

### Flow

1. **Determine preferences**: Use `user.preferredLanguages` (up to 5) + `user.preferredFrameworks`. Fallback to `fetchUserProfile()` (top 3 languages from GitHub).
2. **Fetch issues**: For each of the top 3 languages, call `searchIssues("", language, 30)` in parallel via `Promise.all`. Up to 90 raw issues total.
3. **Enrich**: Two-level cache (CachedIssue + IndexedRepo). Repo-level deduplication.
4. **Calculate match score** (0-100):

| Factor | Points | Logic |
|--------|--------|-------|
| Language rank | 20-50 | 1st = 50, 2nd = 35, 3rd = 20 |
| Health contribution | 0-30 | `healthScore * 0.3` |
| Difficulty bonus | 0-10 | Easy = 10, Medium = 5, Hard = 0 |
| Framework match | 0-10 | +10 if repo description contains any user framework |

5. **Sort by match score** descending, deduplicate, return top 60.

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
| Response Time | 20 | Avg first-comment time on recent issues. <24h = 20, <72h = 15, <168h = 10, else 5 |
| PR Merge Rate | 15 | Merged PRs >=100 = 15, >=50 = 12, >=10 = 8, >=1 = 4 |

**Community size label**: `large` (stars>=1000 or forks>=100), `medium` (stars>=100 or forks>=20), `small` (else).

---

## Difficulty Estimation

Two-tier system:

### Tier 1: Rule-based (instant, free)

Scans title, body, and labels for keyword signals:
- **Easy** (18 keywords): typo, documentation, readme, spelling, first-timers-only, beginner, simple, translation, etc.
- **Medium** (13): feature, refactor, component, test, bug, fix, implement, etc.
- **Hard** (12): architecture, security, performance, migration, api redesign, critical, etc.

Additional: body length (>2000 chars = +hard, <300 = +easy), label overrides.

**Confidence** = max category score / total signals.

### Tier 2: GPT-4o-mini (if confidence < 0.8)

Sends title + body (500 chars) + labels to GPT-4o-mini with `temperature: 0.1`, `max_tokens: 100`, `response_format: json_object`. Returns `{ difficulty, reason }`.

Falls back to rule-based if API key is missing or call fails.

The `usedAI` flag is displayed as a purple sparkle on `DifficultyBadge`.

---

## Caching Strategy

| Collection | TTL | What's Cached | Purpose |
|-----------|-----|---------------|---------|
| `CachedIssue` | 24 hours | Difficulty per issue | Avoid re-computing difficulty within a day |
| `IndexedRepo` | Permanent (stale at 48h) | Health score per repo | Repo health persists across issues, stale-while-revalidate |
| `SearchLog` | Permanent | Search queries + filters | Analytics |
| `Bookmark` | Permanent | Full enriched issue snapshot | User's saved issues |
| `User` | Permanent | Preferences, onboarding | User profile |
| `SurveyVote` | Permanent | Landing page votes | Community feedback |

**MongoDB connection**: Singleton pattern with `global.mongooseCache` to prevent multiple connections during Next.js hot reloading.

---

## Analytics

The hosted version uses Google Analytics 4 (GA4). The measurement ID is configured via the `NEXT_PUBLIC_GA_MEASUREMENT_ID` environment variable. If the variable is unset, no analytics scripts are loaded. Analytics are **consent-gated**:

1. On first visit, `CookieConsent` banner appears at the bottom of the page
2. User clicks **Accept** or **Decline**
3. Choice is stored in `localStorage` (`cookie-consent` key) — banner never shows again
4. If accepted, `GoogleAnalytics` component loads the gtag.js scripts via Next.js `<Script strategy="afterInteractive">`
5. If declined, no tracking scripts are ever loaded

**Communication between components**: `CookieConsent` dispatches a `cookie-consent-update` custom DOM event. `GoogleAnalytics` listens for this event and conditionally renders the `<Script>` tags. Both components read from the same `localStorage` key on mount.

**Self-hosting**: Leave `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset for no analytics, or set your own GA4 measurement ID. You can also remove `GoogleAnalytics` and `CookieConsent` from `src/app/layout.tsx` entirely.

---

## Known Issues and Gotchas

### GitHub API
- `@octokit/graphql` reserves `query` as a parameter name — use `$searchQuery` instead
- `RepositoryOrderField` uses `STARGAZERS` not `STARGAZER_COUNT`
- Issue search does NOT support `stars:` or `forks:` qualifiers (repo search only)
- Issue search sort options: `sort:created`, `sort:comments`, `sort:updated`, `sort:reactions`, `sort:interactions` only
- Labels use OR logic: `label:"a","b","c"` matches ANY

### MongoDB
- `language` field conflicts with text indexes — use `programmingLanguage` instead
- Mongoose `{ new: true }` is deprecated in v9 — use `{ returnDocument: "after" }`

### NextAuth
- JWT tokens are static — mutable state (like `onboardingCompleted`) goes stale mid-session. Always verify against DB.
- Using NextAuth v5 beta (`5.0.0-beta.30`)

### UI
- Radix `Select` with `position="item-aligned"` hijacks scroll — use `position="popper"`
- "Load More" can return duplicates — deduplicated by `id`
- Empty `labels[]` vs `undefined` has different semantics

---

## Deployment

### Vercel

The app auto-deploys to Vercel on push to `main`.

1. Connect GitHub repo to Vercel
2. Set environment variables (all from `.env.example`) for both Production and Preview
3. Update GitHub OAuth App callback URL to production domain
4. `NEXTAUTH_URL` is only needed for Production — Preview uses `VERCEL_URL` automatically

### Build

```bash
npm run build    # Next.js production build with Turbopack
npm start        # Start production server
npm run lint     # ESLint
```
