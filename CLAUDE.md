# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Scout is a multi-agent tech watch (veille) platform that runs via cron, fetches content from multiple sources in parallel, synthesizes it via Ollama Cloud (GLM-5.1), and sends HTML email digests via Resend. All user-facing text is in French.

**Two agents:**
- **tech-ai** — AI, vibe coding, LLM news (original Agent Scout)
- **luxe-digital** — Luxury digital marketing, AR filters, AI agents for premium brands

## Commands

```bash
npm run build          # TypeScript compilation (tsc)
npm start              # Run tech-ai agent (default)
npm run start:luxe     # Run luxe-digital agent
npm test               # Run all tests (vitest run)
npm run test:watch     # Run tests in watch mode
npx vitest run tests/sources/fetch-rss.test.ts  # Run single test file
npx tsc --noEmit       # Type-check without emitting
docker compose up -d   # Start VPS services (Ollama + API bridge)
docker exec ollama ollama pull glm-5.1:cloud  # Pull the model
```

## Architecture

**Entry point:** `src/index.ts` — CLI dispatcher with `--agent` flag (default: `tech-ai`).

**Shared pipeline:** `src/shared/run-agent.ts` — `runAgent(config)` orchestrates:

1. Fetch all sources in parallel (`Promise.allSettled` — failures don't stop others)
2. If zero items across all sources, skip email
3. Synthesize via Ollama Cloud through Express bridge (`src/shared/synthesize.ts` → `server/`)
4. Wrap HTML in email template (`src/shared/send-email.ts`) with per-agent branding
5. Send via Resend

**Directory structure:**

```
src/
├── shared/         # Types, synthesize, email, run-agent (shared across all agents)
├── sources/        # Fetch modules (Bluesky, HN, Reddit, Twitter, RSS)
├── agents/         # Agent configs (tech-ai, luxe-digital)
└── index.ts        # CLI entry point
```

**Agent configs** (each defines sources, system prompt, email branding):

| Agent | Entry | Sources | Sections |
|---|---|---|---|
| **tech-ai** | `src/agents/tech-ai.ts` | Bluesky, Hacker News, Reddit, X/Twitter | À lire absolument, Nouveaux Outils, Tendances |
| **luxe-digital** | `src/agents/luxe-digital.ts` | RSS (Luxury Daily, Luxury Roundtable), Reddit, X/Twitter | Activations Digitales, Outils & Innovations, Tendances |

**Source modules** (each returns `SourceResult`):

| Module | API | Auth | Notes |
|---|---|---|---|
| `src/sources/fetch-bluesky.ts` | AT Protocol `app.bsky.feed.searchPosts` | Optional `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` | Authenticates via `createSession` if credentials provided |
| `src/sources/fetch-hackernews.ts` | Algolia HN search | None | Queries run sequentially, results deduplicated by URL |
| `src/sources/fetch-reddit.ts` | Reddit search API | None | Searches subreddits in parallel, deduplicates by URL |
| `src/sources/fetch-twitter.ts` | Apify `apidojo~tweet-scraper` | `APIFY_API_KEY` | Synchronous run, 15s timeout, 10 items max |
| `src/sources/fetch-rss.ts` | RSS 2.0 / Atom feeds | None | Uses `fast-xml-parser`, deduplicates by URL across feeds |

**VPS (Docker):** `server/` — Express bridge (`index.js`) exposing `POST /generate`, proxying to Ollama at `http://ollama:11434/api/generate`. Model: `glm-5.1:cloud`. Secured via `x-api-key` header. Docker Compose orchestrates `ollama` + `api-bridge` on an internal network.

**Synthesis:** `src/shared/synthesize.ts` — Calls `POST /generate` on the VPS with `prompt`, `systemPrompt` (per-agent), and `model`.

**Email:** `src/shared/send-email.ts` — `buildEmailHtml()` wraps content in an iOS-styled HTML template with per-agent `EmailBranding` (title, subject prefix, footer). `sendEmail()` uses the Resend SDK.

**Shared types:** `src/shared/types.ts` — `SourceResult`, `ContentItem`, `ScoutResult`, `AgentConfig`, `EmailBranding`

## Testing Pattern

Tests use Vitest with `globals: true`. Mocking pattern: `vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(...))` for all external API calls. The `resend` module is mocked at the module level with `vi.mock("resend", ...)`.

## Environment Variables

Required: `VPS_URL`, `RESEND_API_KEY`, `RESEND_TO`
Optional: `API_KEY` (VPS auth), `RESEND_FROM` (default: `onboarding@resend.dev`), `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`, `APIFY_API_KEY`

## Key Constraints

- Ollama runs in Docker; the Express bridge on port 3000 proxies requests with API key auth
- All fetch modules return `SourceResult` with graceful error handling (never throw — errors go in the `error` field)
- Email HTML must use inline styles only (no CSS classes) for email client compatibility
- `systemPrompt` is per-agent (not hardcoded in synthesize module) — each agent defines its own sections and tone
- Cron: `0 9,17 * * * /opt/agent-scout/cron-run.sh --agent tech-ai` and `0 10 * * * /opt/agent-scout/cron-run.sh --agent luxe-digital` on VPS

## VPS

- **IP**: 46.225.59.42
- **API Bridge**: http://46.225.59.42:3001
- **Health check**: `curl http://46.225.59.42:3001/health`
- **SSH**: `ssh root@46.225.59.42`
- **API Key**: `Set in API_KEY env var`

## Deployment

- **GitHub Actions**: `.github/workflows/deploy.yml` — push to `main` triggers test + SSH deploy
- **Deploy process**: SSH to VPS → git pull → npm ci → npm run build → docker compose up -d --build → health check
- **Deploy path on VPS**: `/opt/agent-scout`

## Status (2026-04-16)

- ✅ Multi-agent monorepo: tech-ai + luxe-digital with shared code
- ✅ Health check: `{"status":"ok"}`
- ✅ Synthesis endpoint: POST /generate with API key works (GLM-5.1 Cloud)
- ✅ 24h date filtering added to all sources (commit `24edf87`, `6ddfda5`)
- ✅ RSS source module with fast-xml-parser for luxury industry feeds
- ✅ CLI dispatcher: `--agent=tech-ai` (default) or `--agent=luxe-digital`
- ⚠️ X/Twitter: Apify `start` param not supported → filtered client-side by date instead