# Contributing to IssueScout

Thanks for your interest in contributing to IssueScout! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- A [GitHub OAuth App](https://github.com/settings/applications/new)
- (Optional) An [OpenAI API key](https://platform.openai.com/api-keys) for AI difficulty estimation

## Local Development Setup

1. **Fork and clone the repo**

   ```bash
   git clone https://github.com/<your-username>/issuescout.dev.git
   cd issuescout.dev
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your credentials in `.env.local`. See the [Environment Variables](README.md#environment-variables) section in the README.

4. **Create a GitHub OAuth App**

   Go to [GitHub Developer Settings](https://github.com/settings/applications/new) and create a new OAuth App:

   | Field | Value |
   |---|---|
   | Application name | IssueScout (dev) |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

   Copy the **Client ID** and **Client Secret** into your `.env.local`.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Making Changes

### Branch Naming

Create a branch from `main` using one of these prefixes:

- `feat/` — New features (e.g., `feat/export-bookmarks`)
- `fix/` — Bug fixes (e.g., `fix/duplicate-issues`)
- `chore/` — Maintenance tasks (e.g., `chore/update-deps`)
- `docs/` — Documentation changes (e.g., `docs/api-examples`)

### Workflow

1. Create your branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```

2. Make your changes

3. Verify the build passes:
   ```bash
   npm run build
   ```

4. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add export to CSV for bookmarks"
   ```

5. Push and open a pull request against `main`

### Commit Messages

We follow a lightweight conventional commit style:

- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Maintenance
- `docs:` — Documentation
- `perf:` — Performance improvement

### Code Style

- **TypeScript** — Strict mode enabled. No `any` unless absolutely necessary.
- **Tailwind CSS v4** — Utility-first styling. Use `cn()` from `@/lib/utils` for conditional classes.
- **shadcn/ui** — Use existing components from `src/components/ui/` before adding new ones.
- **All `SelectContent`** must use `position="popper"` (Radix scroll hijack workaround).
- **Environment variables** — Always accessed via `process.env`. Never hardcode credentials.

## Project Structure

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed documentation of the codebase, including models, API routes, services, and components.

## Reporting Issues

- Use [GitHub Issues](https://github.com/turazashvili/issuescout.dev/issues) to report bugs or request features
- Include steps to reproduce for bugs
- Include the expected vs actual behavior

## Supported By

IssueScout is supported by [Vexrail](https://vexrail.com?utm_source=github&utm_medium=contributing_docs&utm_campaign=issuescout).

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
