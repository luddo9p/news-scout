# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Scout is an automated tech watch (veille) agent that monitors AI and vibe coding topics. It runs via cron, fetches content from 4 sources in parallel, synthesizes it via Ollama Cloud (GLM-5.1), and sends an HTML email digest via Resend. All user-facing text is in French.

## Commands

```bash
npm run build          # TypeScript compilation (tsc)
npm start              # Run the scout pipeline (tsx src/scout.ts)
npm test               # Run all tests (vitest run)
npm run test:watch     # Run tests in watch mode
npx vitest run tests/fetch-bluesky.test.ts  # Run single test file
npx tsc --noEmit       # Type-check without emitting
docker compose up -d   # Start VPS services (Ollama + API bridge)
docker exec ollama ollama pull glm-5.1:cloud  # Pull the model
```

## Architecture

**Entry point:** `src/scout.ts` — orchestrates the full pipeline:

1. Fetch all sources in parallel (`Promise.allSettled` — failures don't stop others)
2. If zero items across all sources, skip email
3. Synthesize via Ollama Cloud through Express bridge (`src/synthesize.ts` → `server/`)
4. Wrap HTML in email template (`src/send-email.ts`)
5. Send via Resend (`src/send-email.ts`)

**Source modules** (each returns `SourceResult`):

| Module                    | API                                     | Auth                                                                 | Notes                                                     |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/fetch-bluesky.ts`    | AT Protocol `app.bsky.feed.searchPosts` | Optional `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` for rate limiting | Authenticates via `createSession` if credentials provided |
| `src/fetch-hackernews.ts` | Algolia HN search                       | None                                                                 | Queries run sequentially, results deduplicated by URL     |
| `src/fetch-reddit.ts`     | Reddit search API                       | None                                                                 | Searches subreddits in parallel, deduplicates by URL      |
| `src/fetch-twitter.ts`    | Apify `apidojo~tweet-scraper`           | `APIFY_API_KEY`                                                      | Synchronous run, 15s timeout, 10 items max                |

**VPS (Docker):** `server/` — Express bridge (`index.js`) exposing `POST /generate`, proxying to Ollama at `http://ollama:11434/api/generate`. Model: `glm-5.1:cloud`. Secured via `x-api-key` header. Docker Compose orchestrates `ollama` + `api-bridge` on an internal network.

**Synthesis:** `src/synthesize.ts` — Calls `POST /generate` on the VPS with `prompt`, `systemPrompt`, and `model`. The system prompt requires inline-styled HTML in 3 sections (À lire absolument, Nouveaux Outils, Tendances).

**Email:** `src/send-email.ts` — `buildEmailHtml()` wraps content in an iOS-styled HTML template. `sendEmail()` uses the Resend SDK. Subject is localized French date format.

**Shared types:** `src/types.ts` — `SourceResult`, `ContentItem`, `ScoutResult`

## Testing Pattern

Tests use Vitest with `globals: true`. Mocking pattern: `vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(...))` for all external API calls. The `resend` module is mocked at the module level with `vi.mock("resend", ...)`.

## Environment Variables

Required: `VPS_URL`, `RESEND_API_KEY`, `RESEND_TO`
Optional: `API_KEY` (VPS auth), `RESEND_FROM` (default: `onboarding@resend.dev`), `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `APIFY_API_KEY`

## Key Constraints

- Ollama runs in Docker; the Express bridge on port 3000 proxies requests with API key auth
- All fetch modules return `SourceResult` with graceful error handling (never throw — errors go in the `error` field)
- Email HTML must use inline styles only (no CSS classes) for email client compatibility
- Schedule via cron (e.g. `0 7,15 * * *` for 9h/17h Paris time)
