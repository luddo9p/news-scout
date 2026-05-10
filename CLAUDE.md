# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Scout is a multi-agent veille platform. Each agent fetches content from sources, synthesizes it via Ollama Cloud (Kimi K2.6), and sends HTML email digests via Resend. All user-facing text is in French.

**Two agent pipelines:**
- **Standard pipeline** (`runAgent`) — Fetch sources → synthesize → render HTML → send email. Used by: tech-ai, luxe-digital.
- **Bourse pipeline** (`runBourseScout`) — Scrape portfolio → diff against previous state → send change email if different. Used by: bourse-scout, higgons-scout, maugey-scout, dunand-scout.

## Commands

```bash
npm run build              # TypeScript compilation (tsc)
npm start                  # Run tech-ai (default)
npm run start:luxe         # Run luxe-digital
npm run start:bourse       # Run bourse-scout (Schang)
npm run start:higgons      # Run higgons-scout
npm run start:maugey       # Run maugey-scout
npm run start:dunand       # Run dunand-scout
npm test                   # Run all tests (vitest run)
npm run test:watch         # Run tests in watch mode
npx vitest run tests/shared/render.test.ts  # Run single test file
npx tsc --noEmit           # Type-check without emitting
docker compose up -d       # Start VPS services (Ollama + API bridge)
```

## Architecture

**Entry point:** `src/index.ts` — CLI dispatcher with `--agent` flag. Routes to `runAgent` (standard) or `runBourseScout` (bourse) based on agent name.

### Standard pipeline (`src/shared/run-agent.ts`)

1. Fetch all sources in parallel (`Promise.allSettled` — failures don't stop others)
2. If zero items, skip email
3. Synthesize via Ollama Cloud → Zod-validated `SynthesisData` (`src/shared/synthesize.ts` → `server/`)
4. Render deterministic HTML from `SynthesisData` (`src/shared/render.ts`)
5. Wrap in email template (`src/shared/send-email.ts`) with per-agent branding
6. Send via Resend

### Bourse pipeline (`src/bourse/run-bourse.ts`)

1. Scrape portfolio from WordPress API (`src/bourse/scrape.ts`)
2. Load previous state from JSON file (`src/bourse/persistence.ts`)
3. First run → save state + send init email. Subsequent → compute diff (`src/bourse/diff.ts`)
4. If changes detected → build change email (`src/bourse/email.ts`) + send via Resend + save state
5. No changes → just save state, no email

### Synthesis pipeline (Zod + deterministic rendering)

The LLM returns JSON validated against `SynthesisSchema` (`src/shared/synthesis-schema.ts`). If validation fails, synthesize retries up to 3 times (correction prompt, then reduced items). The validated `SynthesisData` is rendered to HTML by `render.ts` — the LLM never generates HTML directly.

`SynthesisData` structure: `{ sections: [{ title, type: "standard"|"trend", items }] }`
- Standard items: `{ title, url, context, author?, source, score?, tags?[], highlights?[] }`
- Trend items: `{ title, context, citations: [{ text, source, url }] }`

### Directory structure

```
src/
├── shared/           # Types, synthesize, render, email, run-agent, date-filter, synthesis-schema
├── sources/          # Fetch modules (Bluesky, HN, Reddit, Twitter, RSS, Mastodon, DevTo, Lobsters, TerminalFeed)
├── agents/           # Agent configs (tech-ai, luxe-digital, bourse-scout with 4 variants)
├── bourse/           # Bourse-specific: scrape, diff, persistence, email, run-bourse, types
└── index.ts          # CLI entry point (dispatches to standard or bourse pipeline)
```

### Agent configs

| Agent | Entry | Sources | Sections |
|---|---|---|---|
| **tech-ai** | `src/agents/tech-ai.ts` | Bluesky, HN, Reddit, Mastodon, DevTo, RSS, TerminalFeed (GitHub), Lobste.rs | À lire absolument, Nouveaux Outils, Tendances |
| **luxe-digital** | `src/agents/luxe-digital.ts` | RSS (Jing Daily, Vogue Business, Luxury Daily, Luxury Roundtable), Reddit, Bluesky | Activations Digitales, Innovations Luxe, Tendances |
| **bourse-scout** (×4) | `src/agents/bourse-scout.ts` | WordPress API (bourse-portefeuille-conseil.fr) | Portfolio change tracking |

### Source modules

| Module | API | Auth | Notes |
|---|---|---|---|
| `fetch-bluesky.ts` | AT Protocol `app.bsky.feed.searchPosts` | Optional `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` | Authenticates via `createSession` if credentials provided |
| `fetch-hackernews.ts` | Algolia HN search | None | Queries run sequentially, results deduplicated by URL |
| `fetch-reddit.ts` | Reddit search API | None | Searches subreddits in parallel, deduplicates by URL |
| `fetch-twitter.ts` | Apify `apidojo~tweet-scraper` | `APIFY_API_KEY` | Synchronous run, 15s timeout, 10 items max |
| `fetch-rss.ts` | RSS 2.0 / Atom feeds | None | Uses `fast-xml-parser`, deduplicates by URL across feeds |
| `fetch-mastodon.ts` | Mastodon `/api/v2/search` | None | Searches hashtags on mastodon.social |
| `fetch-devto.ts` | Dev.to `/api/articles` | None | Searches by tags, 24h date filter |
| `fetch-lobsters.ts` | Lobste.rs `/hottest.json` | None | No date filter (already curated), 24h client-side filter |
| `fetch-terminalfeed.ts` | GitHub `/search/repositories` | None | Trending repos via GitHub API, 24h date filter |

All source modules use `getSinceTimestamp()` from `src/shared/date-filter.ts` for 24h filtering.

### VPS (Docker)

`server/` — Express bridge (`index.js`) exposing `POST /generate`, proxying to Ollama at `http://ollama:11434/api/generate`. Model: `kimi-k2.6:cloud`. Secured via `x-api-key` header. Docker Compose orchestrates `ollama` + `api-bridge` on an internal network.

### Email

`src/shared/send-email.ts` — `buildEmailHtml()` wraps rendered sections in an iOS-styled HTML template with per-agent `EmailBranding`. `sendEmail()` uses the Resend SDK.

## Testing Pattern

Tests use Vitest with `globals: true` and `environment: "node"`. Test structure mirrors `src/`:

```
tests/
├── agents/      # tech-ai.test.ts, luxe-digital.test.ts, run-agent.test.ts
├── bourse/      # diff.test.ts, persistence.test.ts, scrape.test.ts
├── shared/      # render.test.ts, synthesize.test.ts, synthesis-schema.test.ts, send-email.test.ts, date-filter.test.ts, types.test.ts
└── sources/     # fetch-bluesky.test.ts, fetch-hackernews.test.ts, fetch-reddit.test.ts, fetch-rss.test.ts, fetch-twitter.test.ts
```

Mocking: `vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(...))` for external API calls. The `resend` module is mocked at module level with `vi.mock("resend", ...)`.

## Environment Variables

Required: `VPS_URL`, `RESEND_API_KEY`, `RESEND_TO`
Optional: `API_KEY` (VPS auth), `RESEND_FROM` (default: `onboarding@resend.dev`), `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `APIFY_API_KEY`, `BOURSE_PORTFOLIO_URL`, `HIGGONS_PORTFOLIO_URL`, `MAUGEY_PORTFOLIO_URL`, `DUNAND_PORTFOLIO_URL`, `BOURSE_STATE_PATH`, `HIGGONS_STATE_PATH`, `MAUGEY_STATE_PATH`, `DUNAND_STATE_PATH`

## Key Constraints

- Ollama runs in Docker; Express bridge on port 3000 proxies requests with API key auth
- All fetch modules return `SourceResult` with graceful error handling (never throw — errors go in the `error` field)
- Email HTML uses inline styles only (no CSS classes) for email client compatibility
- `systemPrompt` is per-agent (not hardcoded in synthesize) — each agent defines its own sections and tone
- Synthesis output is validated via Zod (`SynthesisSchema`) before rendering — the LLM never generates HTML
- Bourse agents use a separate pipeline (scrape → diff → email) with JSON state persistence in `data/`
- Cron (VPS crontab, Paris time):
  - `0 9,17 * * *` tech-ai (2×/jour)
  - `0 10 * * 1` luxe-digital (1×/semaine, lundi)
  - `0 18 * * *` bourse-scout (1×/jour)
  - `5 18 * * *` higgons-scout (1×/jour)
  - `10 18 * * *` maugey-scout (1×/jour)
  - `15 18 * * *` dunand-scout (1×/jour)

## VPS

- **IP**: 46.225.59.42
- **API Bridge**: http://46.225.59.42:3001
- **Health check**: `curl http://46.225.59.42:3001/health`
- **SSH**: `ssh root@46.225.59.42`
- **API Key**: Set in `API_KEY` env var

## Deployment

- **GitHub Actions**: `.github/workflows/deploy.yml` — push to `main` triggers test + SSH deploy
- **Deploy process**: SSH to VPS → git pull → npm ci → npm run build → docker compose up -d --build → health check
- **Deploy path on VPS**: `/opt/agent-scout`