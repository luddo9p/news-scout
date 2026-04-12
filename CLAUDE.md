# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Scout is an automated tech watch (veille) agent that monitors AI and vibe coding topics. It runs twice daily via Netlify Scheduled Functions (7h and 15h UTC = 9h/17h Paris time), fetches content from 3 sources in parallel, synthesizes it via Groq (Llama 3.3 70B), and sends an HTML email digest via Resend. All user-facing text is in French.

## Commands

```bash
npm run build        # TypeScript compilation (tsc)
npm test             # Run all tests (vitest run)
npm run test:watch   # Run tests in watch mode
npm run dev          # Start Netlify dev server
npx vitest run tests/fetch-bluesky.test.ts  # Run single test file
npx tsc --noEmit     # Type-check without emitting
```

## Architecture

**Entry point:** `netlify/functions/scout.ts` — a single Netlify Function handler that orchestrates the full pipeline:

1. Fetch all sources in parallel (`Promise.allSettled` — failures don't stop others)
2. If zero items across all sources, return 500 (skip email)
3. Synthesize via Groq API (`src/synthesize.ts`)
4. Wrap HTML in email template (`src/send-email.ts`)
5. Send via Resend (`src/send-email.ts`)
6. Return JSON result with success/failure counts

**Source modules** (each returns `SourceResult`):

| Module                    | API                                     | Auth                                                                 | Notes                                                     |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/fetch-bluesky.ts`    | AT Protocol `app.bsky.feed.searchPosts` | Optional `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` for rate limiting | Authenticates via `createSession` if credentials provided |
| `src/fetch-hackernews.ts` | Algolia HN search                       | None                                                                 | Queries run sequentially, results deduplicated by URL     |
| `src/fetch-twitter.ts`    | None (placeholder)                      | `APIFY_API_KEY` (future)                                             | Returns empty items with error message                    |

**Shared types:** `src/types.ts` — `SourceResult`, `ContentItem`, `ScoutResult`

**Synthesis:** `src/synthesize.ts` — Builds a French-language prompt from all source items, calls Groq with a system prompt requiring inline-styled HTML in 3 sections (À lire absolument, Nouveaux Outils, Tendances).

**Email:** `src/send-email.ts` — `buildEmailHtml()` wraps content in a styled HTML template. `sendEmail()` uses the Resend SDK. Subject is localized French date format.

## Testing Pattern

Tests use Vitest with `globals: true`. Mocking pattern: `vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(...))` for all external API calls. The `resend` module is mocked at the module level with `vi.mock("resend", ...)`.

## Environment Variables

Required: `GROQ_API_KEY`, `RESEND_API_KEY`, `RESEND_TO`
Optional: `RESEND_FROM` (default: `onboarding@resend.dev`), `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `APIFY_API_KEY` (unused placeholder)

## Key Constraints

- Netlify Functions have a 26s timeout; source fetches use 5s timeouts, Groq uses 10s
- All fetch modules return `SourceResult` with graceful error handling (never throw — errors go in the `error` field)
- Email HTML must use inline styles only (no CSS classes) for email client compatibility
- Cron schedule is UTC; times target CEST (Paris UTC+2) with acceptable 1h drift in winter
