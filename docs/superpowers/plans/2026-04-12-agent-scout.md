# Agent Scout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated tech watch agent that monitors AI and vibe coding, synthesizes findings via Groq (Llama 3), and sends a structured HTML email digest via Resend — running twice daily on Netlify Scheduled Functions.

**Architecture:** Single Netlify Function (`scout`) triggered by cron at 9h and 17h Paris time. Fetches from Bluesky, Hacker News, and a Twitter placeholder in parallel, sends all content to Groq for synthesis, then sends the HTML email via Resend. Code is organized in helper modules under `src/` for maintainability.

**Tech Stack:** TypeScript, Netlify Functions, Groq SDK (`groq-sdk`), Resend (`resend`), Vitest for testing

---

## File Structure

```
agent-scout/
├── netlify/
│   └── functions/
│       └── scout.ts              ← handler entry point
├── src/
│   ├── types.ts                  ← shared interfaces
│   ├── fetch-bluesky.ts          ← Bluesky AT Protocol search
│   ├── fetch-hackernews.ts       ← Algolia HN search
│   ├── fetch-twitter.ts          ← Apify placeholder stub
│   ├── synthesize.ts            ← Groq LLM prompt + call
│   └── send-email.ts            ← HTML template + Resend
├── tests/
│   ├── fetch-bluesky.test.ts
│   ├── fetch-hackernews.test.ts
│   ├── synthesize.test.ts
│   └── send-email.test.ts
├── netlify.toml                  ← cron config + function settings
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── .gitignore
```

---

### Task 1: Project scaffolding

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create package.json and install dependencies**

```json
{
  "name": "agent-scout",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "netlify dev",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@netlify/functions": "^2.4.1",
    "groq-sdk": "^1.1.2",
    "resend": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

Then run:

```bash
npm install
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "declaration": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*", "netlify/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.netlify/
.env
*.log
```

- [ ] **Step 5: Create .env.example**

```env
# Required
GROQ_API_KEY=your_groq_api_key
RESEND_API_KEY=re_xxxxx
RESEND_FROM=onboarding@resend.dev
RESEND_TO=your@email.com

# Optional
BLUESKY_HANDLE=
APIFY_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore .env.example
git commit -m "chore: project scaffolding with deps and config"
```

---

### Task 2: Types

**Files:**

- Create: `src/types.ts`

- [ ] **Step 1: Define shared interfaces**

```ts
// src/types.ts

/** Result from a single data source */
export interface SourceResult {
  source: string;
  items: ContentItem[];
  error?: string;
}

/** A single piece of content from any source */
export interface ContentItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  author?: string;
  date?: string;
  score?: number;
}

/** Full result of the scout run */
export interface ScoutResult {
  success: boolean;
  sourcesFetched: number;
  sourcesFailed: number;
  emailSent: boolean;
  errors: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: Bluesky source

**Files:**

- Create: `src/fetch-bluesky.ts`
- Create: `tests/fetch-bluesky.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/fetch-bluesky.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBluesky } from "../src/fetch-bluesky.js";

describe("fetchBluesky", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should search posts by hashtag and return ContentItems", async () => {
    const mockResponse = {
      posts: [
        {
          uri: "at://did:plc:abc/app.bsky.feed.post/123",
          author: { handle: "user.bsky.social", displayName: "User" },
          record: {
            text: "Check out #vibecoding! Building apps with AI",
            createdAt: "2024-12-01T10:00:00Z",
          },
          indexedAt: "2024-12-01T10:00:00Z",
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchBluesky(["#vibecoding"]);

    expect(result.source).toBe("Bluesky");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: expect.stringContaining("vibecoding"),
      url: "https://bsky.app/profile/user.bsky.social/post/123",
      source: "Bluesky",
      author: "User",
    });
  });

  it("should return error when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await fetchBluesky(["#vibecoding"]);

    expect(result.source).toBe("Bluesky");
    expect(result.items).toHaveLength(0);
    expect(result.error).toContain("Network error");
  });

  it("should handle empty results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ posts: [] }), { status: 200 }),
    );

    const result = await fetchBluesky(["#vibecoding"]);

    expect(result.items).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/fetch-bluesky.test.ts
```

Expected: FAIL — `fetchBluesky` does not exist yet.

- [ ] **Step 3: Implement fetchBluesky**

```ts
// src/fetch-bluesky.ts
import type { SourceResult, ContentItem } from "./types.js";

const BSKY_API = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const TIMEOUT_MS = 5000;
const LIMIT = 20;

interface BlueskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
}

interface BlueskyPost {
  uri: string;
  author: BlueskyAuthor;
  record: {
    text: string;
    createdAt: string;
    [key: string]: unknown;
  };
  indexedAt: string;
}

interface BlueskySearchResponse {
  posts: BlueskyPost[];
  cursor?: string;
}

function extractPostId(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

function postToContentItem(post: BlueskyPost): ContentItem {
  const postId = extractPostId(post.uri);
  return {
    title:
      post.record.text.slice(0, 120) +
      (post.record.text.length > 120 ? "..." : ""),
    url: `https://bsky.app/profile/${post.author.handle}/post/${postId}`,
    summary: post.record.text,
    source: "Bluesky",
    author: post.author.displayName || post.author.handle,
    date: post.record.createdAt,
  };
}

export async function fetchBluesky(hashtags: string[]): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const query = hashtags.join(" ");
    const url = `${BSKY_API}?q=${encodeURIComponent(query)}&limit=${LIMIT}`;

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source: "Bluesky",
        items: [],
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data: BlueskySearchResponse = await response.json();
    const items: ContentItem[] = (data.posts ?? []).map(postToContentItem);

    return { source: "Bluesky", items };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: "Bluesky",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/fetch-bluesky.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fetch-bluesky.ts tests/fetch-bluesky.test.ts
git commit -m "feat: implement Bluesky source with tests"
```

---

### Task 4: Hacker News source

**Files:**

- Create: `src/fetch-hackernews.ts`
- Create: `tests/fetch-hackernews.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/fetch-hackernews.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchHackerNews } from "../src/fetch-hackernews.js";

describe("fetchHackerNews", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should search stories and return ContentItems", async () => {
    const mockResponse = {
      hits: [
        {
          objectID: "12345",
          title: "GPT-5 released with major improvements",
          url: "https://example.com/gpt5",
          author: "pg",
          points: 342,
          num_comments: 89,
          created_at: "2024-12-01T10:00:00Z",
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchHackerNews(["AI"]);

    expect(result.source).toBe("Hacker News");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "GPT-5 released with major improvements",
      url: "https://example.com/gpt5",
      source: "Hacker News",
      author: "pg",
      score: 342,
    });
  });

  it("should skip stories without titles", async () => {
    const mockResponse = {
      hits: [
        {
          objectID: "999",
          title: null,
          url: "https://example.com",
          author: "bot",
          points: 1,
        },
        {
          objectID: "123",
          title: "Valid story",
          url: "https://example.com/valid",
          author: "user",
          points: 10,
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchHackerNews(["AI"]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Valid story");
  });

  it("should return error when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Timeout"));

    const result = await fetchHackerNews(["AI"]);

    expect(result.items).toHaveLength(0);
    expect(result.error).toContain("Timeout");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/fetch-hackernews.test.ts
```

Expected: FAIL — `fetchHackerNews` does not exist yet.

- [ ] **Step 3: Implement fetchHackerNews**

```ts
// src/fetch-hackernews.ts
import type { SourceResult, ContentItem } from "./types.js";

const HN_API = "https://hn.algolia.com/api/v1/search";
const TIMEOUT_MS = 5000;
const HITS_PER_PAGE = 10;

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number;
  num_comments: number;
  created_at: string;
}

interface HNSearchResponse {
  hits: HNHit[];
  nbHits: number;
}

function hitToContentItem(hit: HNHit): ContentItem | null {
  if (!hit.title) return null;
  return {
    title: hit.title,
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    summary: hit.title,
    source: "Hacker News",
    author: hit.author || undefined,
    date: hit.created_at,
    score: hit.points,
  };
}

export async function fetchHackerNews(
  queries: string[],
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const allItems: ContentItem[] = [];

    for (const query of queries) {
      const url = `${HN_API}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${HITS_PER_PAGE}`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        return {
          source: "Hacker News",
          items: allItems,
          error: `API returned ${response.status} for query "${query}"`,
        };
      }

      const data: HNSearchResponse = await response.json();
      const items = data.hits
        .map(hitToContentItem)
        .filter((item): item is ContentItem => item !== null);
      allItems.push(...items);
    }

    clearTimeout(timeout);

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    return { source: "Hacker News", items: unique };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: "Hacker News",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/fetch-hackernews.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/fetch-hackernews.ts tests/fetch-hackernews.test.ts
git commit -m "feat: implement Hacker News source with tests"
```

---

### Task 5: X/Twitter placeholder

**Files:**

- Create: `src/fetch-twitter.ts`

- [ ] **Step 1: Implement the placeholder stub**

```ts
// src/fetch-twitter.ts
import type { SourceResult } from "./types.js";

/**
 * Placeholder for X/Twitter source via Apify.
 * To activate, set APIFY_API_KEY in .env and replace this
 * function with a real Apify Actor call.
 */
export async function fetchTwitter(): Promise<SourceResult> {
  return {
    source: "X/Twitter",
    items: [],
    error:
      "Pas encore configuré. Définissez APIFY_API_KEY et remplacez fetchTwitter() par un appel Apify Actor.",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/fetch-twitter.ts
git commit -m "feat: add X/Twitter placeholder stub"
```

---

### Task 6: Groq synthesis

**Files:**

- Create: `src/synthesize.ts`
- Create: `tests/synthesize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/synthesize.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPrompt, synthesize } from "../src/synthesize.js";
import type { SourceResult } from "../src/types.js";

describe("buildPrompt", () => {
  it("should build a prompt with all source content", () => {
    const sources: SourceResult[] = [
      {
        source: "Bluesky",
        items: [
          {
            title: "Post 1",
            url: "https://bsky.app/1",
            summary: "About vibe coding",
            source: "Bluesky",
          },
        ],
      },
      {
        source: "Hacker News",
        items: [
          {
            title: "HN Story",
            url: "https://hn.app/1",
            summary: "New AI tool",
            source: "Hacker News",
            score: 100,
          },
        ],
      },
    ];

    const prompt = buildPrompt(sources);

    expect(prompt).toContain("Bluesky");
    expect(prompt).toContain("Post 1");
    expect(prompt).toContain("Hacker News");
    expect(prompt).toContain("HN Story");
    expect(prompt).toContain("À lire absolument");
  });

  it("should include error messages for failed sources", () => {
    const sources: SourceResult[] = [
      {
        source: "X/Twitter",
        items: [],
        error: "Pas encore configuré",
      },
    ];

    const prompt = buildPrompt(sources);

    expect(prompt).toContain("X/Twitter");
    expect(prompt).toContain("Pas encore configuré");
  });
});

describe("synthesize", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call Groq API and return HTML content", async () => {
    const mockCompletion = {
      choices: [
        {
          message: {
            content:
              "<h1>Agent Scout</h1><h2>À lire absolument</h2><p>Test content</p>",
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockCompletion), { status: 200 }),
    );

    const result = await synthesize(
      [
        {
          source: "Test",
          items: [
            {
              title: "Test",
              url: "https://example.com",
              summary: "Test",
              source: "Test",
            },
          ],
        },
      ],
      "fake-groq-key",
    );

    expect(result).toContain("À lire absolument");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/synthesize.test.ts
```

Expected: FAIL — `buildPrompt` and `synthesize` do not exist yet.

- [ ] **Step 3: Implement synthesize module**

```ts
// src/synthesize.ts
import type { SourceResult } from "./types.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `Tu es Agent Scout, un analyste de veille technologique. Tu synthétises des contenus provenant de différentes sources web en un résumé structuré en HTML.

Tu DOIS produire du HTML valide avec des styles inline (compatible clients email). Ta réponse doit contenir UNIQUEMENT le HTML du corps de l'email, sans <html>, <head> ou <body>.

Structure obligatoire avec ces 3 sections :

1. **À lire absolument** — Les 3-5 contenus les plus importants ou impactants. Pour chaque contenu, inclus un lien cliquable et une phrase de contexte.

2. **Nouveaux Outils** — Outils, projets, librairies ou frameworks mentionnés. Inclus les liens quand disponibles.

3. **Tendances** — Tendances émergentes ou patterns récurrents observés dans les contenus.

Format HTML requis :
- Utilise <h2> pour les sections avec style inline coloré
- Utilise <ul>/<li> pour les listes
- Chaque item doit avoir un <a href="..." style="color:#2563eb">lien</a> cliquable
- Ajoute une phrase de contexte après chaque lien
- Utilise <em> pour les noms d'auteurs/sources
- Pas de CSS classes, que des styles inline
- Style moderne et lisible, fond blanc, texte sombre`;

export function buildPrompt(sources: SourceResult[]): string {
  let content = "Voici les contenus collectés aujourd'hui :\n\n";

  for (const source of sources) {
    content += `## Source : ${source.source}\n`;
    if (source.error) {
      content += `⚠️ Erreur : ${source.error}\n\n`;
      continue;
    }
    if (source.items.length === 0) {
      content += "(Aucun contenu trouvé)\n\n";
      continue;
    }
    for (const item of source.items) {
      content += `- **${item.title}**`;
      if (item.author) content += ` (par ${item.author})`;
      if (item.score) content += ` [${item.score} points]`;
      content += `\n  Lien : ${item.url}`;
      content += `\n  Résumé : ${item.summary}\n`;
    }
    content += "\n";
  }

  return content;
}

export async function synthesize(
  sources: SourceResult[],
  apiKey: string,
): Promise<string> {
  const userPrompt = buildPrompt(sources);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const htmlContent: string = data.choices?.[0]?.message?.content;

    if (!htmlContent) {
      throw new Error("Groq returned empty content");
    }

    return htmlContent;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/synthesize.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/synthesize.ts tests/synthesize.test.ts
git commit -m "feat: implement Groq synthesis with prompt and API call"
```

---

### Task 7: Email template + Resend

**Files:**

- Create: `src/send-email.ts`
- Create: `tests/send-email.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/send-email.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEmailHtml, sendEmail } from "../src/send-email.js";

describe("buildEmailHtml", () => {
  it("should wrap content in a complete HTML email", () => {
    const content = "<h2>À lire absolument</h2><p>Test item</p>";
    const html = buildEmailHtml(content, new Date("2024-12-01T10:00:00Z"));

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Agent Scout");
    expect(html).toContain("À lire absolument");
    expect(html).toContain("1 décembre 2024");
    expect(html).toContain("style=");
  });

  it("should include all 3 sections when present", () => {
    const content = `
      <h2>À lire absolument</h2><p>Item 1</p>
      <h2>Nouveaux Outils</h2><p>Item 2</p>
      <h2>Tendances</h2><p>Item 3</p>
    `;
    const html = buildEmailHtml(content, new Date());

    expect(html).toContain("À lire absolument");
    expect(html).toContain("Nouveaux Outils");
    expect(html).toContain("Tendances");
  });
});

describe("sendEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call Resend API and return success", async () => {
    const mockResponse = {
      id: "email-123",
      from: "onboarding@resend.dev",
      to: "test@example.com",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await sendEmail({
      htmlContent: "<h1>Test</h1>",
      subject: "Agent Scout - Test",
      from: "onboarding@resend.dev",
      to: "test@example.com",
      apiKey: "re_test_key",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("email-123");
  });

  it("should return failure when Resend API returns error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Invalid API key" } }), {
        status: 401,
      }),
    );

    const result = await sendEmail({
      htmlContent: "<h1>Test</h1>",
      subject: "Agent Scout - Test",
      from: "onboarding@resend.dev",
      to: "test@example.com",
      apiKey: "invalid_key",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid API key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/send-email.test.ts
```

Expected: FAIL — `buildEmailHtml` and `sendEmail` do not exist yet.

- [ ] **Step 3: Implement send-email module**

```ts
// src/send-email.ts
import { Resend } from "resend";

const RESEND_API = "https://api.resend.com/emails";

interface SendEmailParams {
  htmlContent: string;
  subject: string;
  from: string;
  to: string;
  apiKey: string;
}

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

const EMAIL_SUBJECT = (date: Date): string => {
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Agent Scout — Veille du ${formatted}`;
};

export function buildEmailHtml(content: string, date: Date): string {
  const formattedDate = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
    <tr>
      <td style="background-color:#1a1a2e;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
          &#128270; Agent Scout
        </h1>
        <p style="margin:8px 0 0;color:#a0a0b8;font-size:14px;">
          Veille IA &amp; Vibe Coding &mdash; ${formattedDate}
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="text-align:center;padding:20px;color:#888888;font-size:12px;">
        <p style="margin:0;">Généré automatiquement par Agent Scout</p>
        <p style="margin:4px 0 0;">Sources : Bluesky &bull; Hacker News &bull; X/Twitter</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { htmlContent, subject, from, to, apiKey } = params;

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: htmlContent,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export { EMAIL_SUBJECT };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/send-email.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/send-email.ts tests/send-email.test.ts
git commit -m "feat: implement email template and Resend sending"
```

---

### Task 8: Main handler

**Files:**

- Create: `netlify/functions/scout.ts`

- [ ] **Step 1: Implement the main handler**

```ts
// netlify/functions/scout.ts
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { fetchBluesky } from "../../src/fetch-bluesky.js";
import { fetchHackerNews } from "../../src/fetch-hackernews.js";
import { fetchTwitter } from "../../src/fetch-twitter.js";
import { synthesize } from "../../src/synthesize.js";
import {
  buildEmailHtml,
  sendEmail,
  EMAIL_SUBJECT,
} from "../../src/send-email.js";
import type { ScoutResult, SourceResult } from "../../src/types.js";

const BLUESKY_HASHTAGS = ["#vibecoding", "#IA"];
const HN_QUERIES = ["AI", "LLM"];

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  console.log("[Agent Scout] Starting scout run...");

  const startTime = Date.now();

  // 1. Fetch all sources in parallel
  console.log("[Agent Scout] Fetching sources...");
  const results = await Promise.allSettled([
    fetchBluesky(BLUESKY_HASHTAGS),
    fetchHackerNews(HN_QUERIES),
    fetchTwitter(),
  ]);

  const sources: SourceResult[] = results.map((result, index) => {
    const sourceNames = ["Bluesky", "Hacker News", "X/Twitter"];
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      source: sourceNames[index],
      items: [],
      error: result.reason?.message || String(result.reason),
    };
  });

  const sourcesFetched = sources.filter((s) => !s.error).length;
  const sourcesFailed = sources.filter((s) => s.error).length;

  console.log(
    `[Agent Scout] Fetched: ${sourcesFetched} success, ${sourcesFailed} failed`,
  );

  // 2. Check if we have any content
  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);
  if (totalItems === 0) {
    console.error(
      "[Agent Scout] No content fetched from any source. Skipping email.",
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "No content fetched from any source",
        sourcesFetched,
        sourcesFailed,
      }),
    };
  }

  // 3. Synthesize with Groq
  console.log("[Agent Scout] Synthesizing with Groq...");
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error("[Agent Scout] Missing GROQ_API_KEY");
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Missing GROQ_API_KEY" }),
    };
  }

  let htmlContent: string;
  try {
    htmlContent = await synthesize(sources, groqApiKey);
  } catch (err) {
    console.error("[Agent Scout] Groq synthesis failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Groq synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      }),
    };
  }

  // 4. Build email
  console.log("[Agent Scout] Building email...");
  const now = new Date();
  const subject = EMAIL_SUBJECT(now);
  const emailHtml = buildEmailHtml(htmlContent, now);

  // 5. Send email via Resend
  console.log("[Agent Scout] Sending email via Resend...");
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
  const resendTo = process.env.RESEND_TO;

  if (!resendApiKey || !resendTo) {
    console.error("[Agent Scout] Missing RESEND_API_KEY or RESEND_TO");
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "Missing Resend configuration",
      }),
    };
  }

  const emailResult = await sendEmail({
    htmlContent: emailHtml,
    subject,
    from: resendFrom,
    to: resendTo,
    apiKey: resendApiKey,
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Agent Scout] Run completed in ${elapsed}ms`);

  const result: ScoutResult = {
    success: emailResult.success,
    sourcesFetched,
    sourcesFailed,
    emailSent: emailResult.success,
    errors: [
      ...sources.filter((s) => s.error).map((s) => `${s.source}: ${s.error}`),
      ...(emailResult.error ? [`Resend: ${emailResult.error}`] : []),
    ],
  };

  return {
    statusCode: emailResult.success ? 200 : 500,
    body: JSON.stringify(result),
  };
};

export { handler };
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/scout.ts
git commit -m "feat: implement main scout handler with orchestration"
```

---

### Task 9: Netlify configuration

**Files:**

- Create: `netlify.toml`

- [ ] **Step 1: Create netlify.toml**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[cron]]
  schedule = "0 7 * * *"
  function = "scout"

[[cron]]
  schedule = "0 15 * * *"
  function = "scout"
```

Note: The cron times are in UTC. `0 7 * * *` = 9h Paris (CEST, UTC+2). `0 15 * * *` = 17h Paris (CEST, UTC+2). During winter (CET, UTC+1), these will be 8h and 16h Paris time, which is acceptable for a watch digest.

- [ ] **Step 2: Commit**

```bash
git add netlify.toml
git commit -m "feat: add netlify.toml with cron schedule and build config"
```

---

### Task 10: Final verification and smoke test

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (4 test files, 8 test cases total).

- [ ] **Step 2: Create .env file from .env.example**

```bash
cp .env.example .env
```

Then fill in actual API keys in `.env`.

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Test locally with Netlify CLI**

```bash
npm install -g netlify-cli
netlify login
netlify dev
```

Then trigger the function manually:

```bash
curl http://localhost:9999/.netlify/functions/scout
```

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: final fixes from smoke test"
```
