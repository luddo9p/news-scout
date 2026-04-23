# Multi-Agent Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor agent-scout into a monorepo supporting two independent agents (tech-ai + luxe-digital) with shared code and per-agent configuration.

**Architecture:** Shared modules (types, synthesis, email, sources) live in `src/shared/` and `src/sources/`. Each agent has an entry point in `src/agents/` with its own config (sources, system prompt, email branding). A CLI dispatcher in `src/index.ts` routes `--agent` flag to the correct agent. New `src/sources/fetch-rss.ts` adds RSS feed capability for luxury industry publications.

**Tech Stack:** TypeScript, Node.js, tsx, Vitest, Resend, Ollama Cloud (GLM-5.1)

---

## File Structure (Final State)

```
src/
├── shared/
│   ├── types.ts              # SourceResult, ContentItem, ScoutResult, AgentConfig
│   ├── date-filter.ts         # getSinceTimestamp() — unchanged
│   ├── synthesize.ts         # synthesize() — takes systemPrompt as param
│   └── send-email.ts         # buildEmailHtml(), sendEmail() — takes branding params
├── sources/
│   ├── fetch-bluesky.ts      # Moved from src/fetch-bluesky.ts
│   ├── fetch-hackernews.ts   # Moved from src/fetch-hackernews.ts
│   ├── fetch-reddit.ts       # Moved from src/fetch-reddit.ts
│   ├── fetch-twitter.ts      # Moved from src/fetch-twitter.ts
│   └── fetch-rss.ts          # NEW — generic RSS fetcher
├── agents/
│   ├── tech-ai.ts             # Entry point for AI/tech agent (ex scout.ts)
│   └── luxe-digital.ts       # Entry point for luxury digital marketing agent
└── index.ts                   # CLI dispatcher: --agent tech-ai|luxe-digital
tests/
├── shared/
│   ├── synthesize.test.ts
│   ├── send-email.test.ts
│   └── date-filter.test.ts
├── sources/
│   ├── fetch-bluesky.test.ts
│   ├── fetch-hackernews.test.ts
│   ├── fetch-reddit.test.ts
│   ├── fetch-twitter.test.ts
│   └── fetch-rss.test.ts       # NEW
└── agents/
    ├── tech-ai.test.ts         # NEW
    └── luxe-digital.test.ts    # NEW
```

---

### Task 1: Add AgentConfig type and make types.ts shared-ready

**Files:**
- Create: `src/shared/types.ts`
- Delete: `src/types.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/shared/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { AgentConfig } from "../../src/shared/types.js";

describe("AgentConfig type", () => {
  it("should accept a valid tech-ai config shape", () => {
    const config: AgentConfig = {
      name: "tech-ai",
      sources: [],
      systemPrompt: "Tu es Agent Scout...",
      emailBranding: {
        title: "Agent Scout",
        subjectPrefix: "Agent Scout",
        footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
      },
    };
    expect(config.name).toBe("tech-ai");
    expect(config.emailBranding.title).toBe("Agent Scout");
  });
});
```

- [ ] **Step 2: Create `src/shared/types.ts` with AgentConfig**

```typescript
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

/** Email branding configuration per agent */
export interface EmailBranding {
  title: string;
  subjectPrefix: string;
  footerSources: string;
}

/** Agent configuration — defines sources, prompts, and branding */
export interface AgentConfig {
  name: string;
  sources: (() => Promise<SourceResult>)[];
  systemPrompt: string;
  emailBranding: EmailBranding;
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/shared/types.test.ts`
Expected: PASS

- [ ] **Step 4: Delete old `src/types.ts`**

Run: `rm src/types.ts`

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts tests/shared/types.test.ts
git rm src/types.ts
git commit -m "refactor: move types to shared/ with AgentConfig type"
```

---

### Task 2: Move date-filter.ts to shared/

**Files:**
- Create: `src/shared/date-filter.ts` (copy of `src/date-filter.ts`)
- Delete: `src/date-filter.ts`

- [ ] **Step 1: Copy date-filter.ts to shared/ and update imports**

Copy `src/date-filter.ts` → `src/shared/date-filter.ts` (content unchanged).

- [ ] **Step 2: Move the test**

Copy `tests/date-filter.test.ts` → `tests/shared/date-filter.test.ts` and update import path from `"../src/date-filter.js"` → `"../../src/shared/date-filter.js"`.

- [ ] **Step 3: Run test to verify**

Run: `npx vitest run tests/shared/date-filter.test.ts`
Expected: PASS

- [ ] **Step 4: Delete old files**

Run: `rm src/date-filter.ts tests/date-filter.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/shared/date-filter.ts tests/shared/date-filter.test.ts
git rm src/date-filter.ts tests/date-filter.test.ts
git commit -m "refactor: move date-filter to shared/"
```

---

### Task 3: Make synthesize.ts configurable (accept systemPrompt as parameter)

**Files:**
- Create: `src/shared/synthesize.ts`
- Delete: `src/synthesize.ts`

The key change: `SYSTEM_PROMPT` is no longer a module constant. `synthesize()` and `buildPrompt()` accept it as a parameter.

- [ ] **Step 1: Write the failing test**

Create `tests/shared/synthesize.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPrompt, synthesize } from "../../src/shared/synthesize.js";
import type { SourceResult } from "../../src/shared/types.js";

const CUSTOM_SYSTEM_PROMPT = "Tu es un analyste luxe digital. Structure: Tendances, Marques, Outils.";

describe("buildPrompt", () => {
  it("should build a prompt with custom system prompt context", () => {
    const sources: SourceResult[] = [
      {
        source: "Luxury Daily",
        items: [
          {
            title: "Gucci AR Lens",
            url: "https://luxurydaily.com/gucci-ar",
            summary: "Gucci launches AR lens on Snapchat",
            source: "Luxury Daily",
          },
        ],
      },
    ];

    const prompt = buildPrompt(sources);

    expect(prompt).toContain("Luxury Daily");
    expect(prompt).toContain("Gucci AR Lens");
    expect(prompt).toContain("N'invente aucun lien");
    expect(prompt).toContain("Rédige en français");
  });

  it("should include error messages for failed sources", () => {
    const sources: SourceResult[] = [
      {
        source: "Glossy",
        items: [],
        error: "RSS feed unavailable",
      },
    ];

    const prompt = buildPrompt(sources);

    expect(prompt).toContain("Glossy");
    expect(prompt).toContain("RSS feed unavailable");
  });

  it("should include score information for prioritization", () => {
    const sources: SourceResult[] = [
      {
        source: "Reddit",
        items: [
          {
            title: "Dior digital campaign",
            url: "https://reddit.com/r/luxury/1",
            summary: "Dior's new AR activation",
            source: "Reddit",
            score: 342,
          },
        ],
      },
    ];

    const prompt = buildPrompt(sources);

    expect(prompt).toContain("342 points");
  });

  it("should limit items per source and truncate summaries", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      title: `Item ${i}`,
      url: `https://example.com/${i}`,
      summary: "x".repeat(200),
      source: "Test",
    }));

    const sources: SourceResult[] = [{ source: "Test", items }];
    const prompt = buildPrompt(sources);

    const matches = prompt.match(/- \*\*Item \d+\*\*/g);
    expect(matches).toHaveLength(5);
    expect(prompt).toContain("...");
  });
});

describe("synthesize", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call VPS /generate with custom systemPrompt", async () => {
    const mockResponse = {
      content: "<h2>Tendances</h2><p>Test content</p>",
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
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
      "http://localhost:3000",
      CUSTOM_SYSTEM_PROMPT,
      "test-api-key",
    );

    expect(result).toContain("Tendances");

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.systemPrompt).toBe(CUSTOM_SYSTEM_PROMPT);
  });

  it("should work without API key", async () => {
    const mockResponse = { content: "<p>Test</p>" };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    await synthesize(
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
      "http://localhost:3000",
      "Any system prompt",
    );

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    expect((options.headers as Record<string, string>)["x-api-key"]).toBe(
      undefined,
    );
  });

  it("should throw on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid key" }), { status: 401 }),
    );

    await expect(
      synthesize(
        [
          {
            source: "Test",
            items: [
              {
                title: "T",
                url: "https://x.com",
                summary: "s",
                source: "Test",
              },
            ],
          },
        ],
        "http://localhost:3000",
        "Any system prompt",
        "bad-key",
      ),
    ).rejects.toThrow("Ollama API error 401");
  });

  it("should throw on empty response", async () => {
    const mockResponse = { content: "" };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    await expect(
      synthesize(
        [
          {
            source: "Test",
            items: [
              {
                title: "T",
                url: "https://x.com",
                summary: "s",
                source: "Test",
              },
            ],
          },
        ],
        "http://localhost:3000",
        "Any system prompt",
      ),
    ).rejects.toThrow("Ollama returned empty content");
  });

  it("should throw on timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => {
      const error = new Error("Aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    await expect(
      synthesize(
        [
          {
            source: "Test",
            items: [
              {
                title: "T",
                url: "https://x.com",
                summary: "s",
                source: "Test",
              },
            ],
          },
        ],
        "http://localhost:3000",
        "Any system prompt",
      ),
    ).rejects.toThrow("Ollama API timeout");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/synthesize.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/shared/synthesize.ts`**

```typescript
import type { SourceResult } from "./types.js";

const DEFAULT_MODEL = "glm-5.1:cloud";
const TIMEOUT_MS = 300000;
const MAX_ITEMS_PER_SOURCE = 5;
const MAX_SUMMARY_LENGTH = 100;

export function buildPrompt(sources: SourceResult[]): string {
  let content =
    "Voici les contenus collectés aujourd'hui. Synthétise-les en suivant les sections définies dans le prompt système.\n\n";
  content += "Règles :\n";
  content +=
    "- Rédige en français. Traduis les titres anglais si nécessaire.\n";
  content +=
    "- N'invente aucun lien. Utilise uniquement les URLs fournies ci-dessous.\n";
  content +=
    "- Si plusieurs sources couvrent le même sujet, fusionne-les en un seul item.\n";
  content +=
    "- Utilise les scores (points) pour prioriser les items dans les sections importantes.\n\n";

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
    const items = source.items
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, MAX_ITEMS_PER_SOURCE);
    for (const item of items) {
      const summary =
        item.summary.length > MAX_SUMMARY_LENGTH
          ? item.summary.slice(0, MAX_SUMMARY_LENGTH) + "..."
          : item.summary;
      content += `- **${item.title}**`;
      if (item.author) content += ` (par ${item.author})`;
      if (item.score) content += ` [${item.score} points]`;
      content += `\n  Lien : ${item.url}`;
      content += `\n  Résumé : ${summary}\n`;
    }
    content += "\n";
  }

  return content;
}

export async function synthesize(
  sources: SourceResult[],
  vpsUrl: string,
  systemPrompt: string,
  apiKey?: string,
): Promise<string> {
  const userPrompt = buildPrompt(sources);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(`${vpsUrl}/generate`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        prompt: userPrompt,
        systemPrompt,
        model: DEFAULT_MODEL,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const htmlContent: string = data.content;

    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error("Ollama returned empty content");
    }

    return htmlContent;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Ollama API timeout");
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shared/synthesize.test.ts`
Expected: PASS

- [ ] **Step 5: Delete old file and commit**

```bash
rm src/synthesize.ts tests/synthesize.test.ts
git add src/shared/synthesize.ts tests/shared/synthesize.test.ts
git rm src/synthesize.ts tests/synthesize.test.ts
git commit -m "refactor: make synthesize configurable with systemPrompt param"
```

---

### Task 4: Make send-email.ts configurable (accept branding params)

**Files:**
- Create: `src/shared/send-email.ts`
- Delete: `src/send-email.ts`

The key change: `buildEmailHtml()` and `EMAIL_SUBJECT` accept `EmailBranding` as parameter instead of hardcoding "Agent Scout".

- [ ] **Step 1: Write the failing test**

Create `tests/shared/send-email.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  buildEmailHtml,
  makeEmailSubject,
} from "../../src/shared/send-email.js";
import type { EmailBranding } from "../../src/shared/types.js";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "email-123" }, error: null }),
    },
  })),
}));

import { sendEmail } from "../../src/shared/send-email.js";

const SCOUT_BRANDING: EmailBranding = {
  title: "Agent Scout",
  subjectPrefix: "Agent Scout",
  footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
};

const LUXE_BRANDING: EmailBranding = {
  title: "Luxe Digital Scout",
  subjectPrefix: "Luxe Digital",
  footerSources: "Luxury Daily · Reddit · X/Twitter · RSS",
};

describe("buildEmailHtml", () => {
  it("should use custom branding title", () => {
    const content = "<h2>Tendances</h2><p>Test item</p>";
    const html = buildEmailHtml(content, new Date("2024-12-01T10:00:00Z"), LUXE_BRANDING);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Luxe Digital Scout");
    expect(html).not.toContain("Agent Scout");
  });

  it("should use custom footer sources", () => {
    const content = "<p>Test</p>";
    const html = buildEmailHtml(content, new Date(), LUXE_BRANDING);

    expect(html).toContain("Luxury Daily · Reddit · X/Twitter · RSS");
  });

  it("should work with original scout branding", () => {
    const content = "<p>Test</p>";
    const html = buildEmailHtml(content, new Date(), SCOUT_BRANDING);

    expect(html).toContain("Agent Scout");
    expect(html).toContain("Bluesky · Hacker News · Reddit · X/Twitter");
  });
});

describe("makeEmailSubject", () => {
  it("should format subject with custom prefix", () => {
    const subject = makeEmailSubject(new Date("2024-12-01T10:00:00Z"), LUXE_BRANDING);

    expect(subject).toContain("Luxe Digital");
    expect(subject).toContain("Veille du");
  });

  it("should format subject with scout prefix", () => {
    const subject = makeEmailSubject(new Date("2024-12-01T10:00:00Z"), SCOUT_BRANDING);

    expect(subject).toContain("Agent Scout");
  });
});

describe("sendEmail", () => {
  it("should call Resend and return success", async () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shared/send-email.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/shared/send-email.ts`**

```typescript
import { Resend } from "resend";
import type { EmailBranding } from "./types.js";

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

export function makeEmailSubject(date: Date, branding: EmailBranding): string {
  const formatted = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `${branding.subjectPrefix} — Veille du ${formatted}`;
}

export function buildEmailHtml(
  content: string,
  date: Date,
  branding: EmailBranding,
): string {
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
<body style="margin:0;padding:0;background-color:#f2f2f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;color:#1c1c1e;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
    <tr>
      <td style="padding:40px 0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 24px;">
              <h1 style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#1c1c1e;">
                ${branding.title}
              </h1>
              <p style="margin:6px 0 0;font-size:15px;font-weight:400;color:#8e8e93;">
                ${formattedDate}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 24px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#8e8e93;line-height:1.5;">
          Généré automatiquement par ${branding.title}<br>
          Sources : ${branding.footerSources}
        </p>
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shared/send-email.test.ts`
Expected: PASS

- [ ] **Step 5: Delete old file and commit**

```bash
rm src/send-email.ts tests/send-email.test.ts
git add src/shared/send-email.ts tests/shared/send-email.test.ts
git rm src/send-email.ts tests/send-email.test.ts
git commit -m "refactor: make email branding configurable via EmailBranding"
```

---

### Task 5: Move source modules to src/sources/

**Files:**
- Move: `src/fetch-bluesky.ts` → `src/sources/fetch-bluesky.ts`
- Move: `src/fetch-hackernews.ts` → `src/sources/fetch-hackernews.ts`
- Move: `src/fetch-reddit.ts` → `src/sources/fetch-reddit.ts`
- Move: `src/fetch-twitter.ts` → `src/sources/fetch-twitter.ts`
- Move: all 4 test files → `tests/sources/`

This is a pure move + import path update. No logic changes.

- [ ] **Step 1: Move fetch-bluesky.ts and update its import**

Copy `src/fetch-bluesky.ts` → `src/sources/fetch-bluesky.ts`. Change import from `"./types.js"` → `"../shared/types.js"` and `"./date-filter.js"` → `"../shared/date-filter.js"`.

- [ ] **Step 2: Move fetch-hackernews.ts and update its import**

Copy `src/fetch-hackernews.ts` → `src/sources/fetch-hackernews.ts`. Change import from `"./types.js"` → `"../shared/types.js"` and `"./date-filter.js"` → `"../shared/date-filter.js"`.

- [ ] **Step 3: Move fetch-reddit.ts and update its import**

Copy `src/fetch-reddit.ts` → `src/sources/fetch-reddit.ts`. Change import from `"./types.js"` → `"../shared/types.js"`.

- [ ] **Step 4: Move fetch-twitter.ts and update its import**

Copy `src/fetch-twitter.ts` → `src/sources/fetch-twitter.ts`. Change import from `"./types.js"` → `"../shared/types.js"` and `"./date-filter.js"` → `"../shared/date-filter.js"`.

- [ ] **Step 5: Move test files and update import paths**

Move each test file from `tests/` → `tests/sources/` and update imports:
- `fetch-bluesky.test.ts`: `"../src/fetch-bluesky.js"` → `"../../src/sources/fetch-bluesky.js"`
- `fetch-hackernews.test.ts`: `"../src/fetch-hackernews.js"` → `"../../src/sources/fetch-hackernews.js"`
- `fetch-reddit.test.ts`: `"../src/fetch-reddit.js"` → `"../../src/sources/fetch-reddit.js"`
- `fetch-twitter.test.ts`: `"../src/fetch-twitter.js"` → `"../../src/sources/fetch-twitter.js"`

- [ ] **Step 6: Run all existing tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Delete old source files and commit**

```bash
rm src/fetch-bluesky.ts src/fetch-hackernews.ts src/fetch-reddit.ts src/fetch-twitter.ts
rm tests/fetch-bluesky.test.ts tests/fetch-hackernews.test.ts tests/fetch-reddit.test.ts tests/fetch-twitter.test.ts
git add src/sources/ tests/sources/
git rm src/fetch-bluesky.ts src/fetch-hackernews.ts src/fetch-reddit.ts src/fetch-twitter.ts
git rm tests/fetch-bluesky.test.ts tests/fetch-hackernews.test.ts tests/fetch-reddit.test.ts tests/fetch-twitter.test.ts
git commit -m "refactor: move source modules to src/sources/"
```

---

### Task 6: Create the tech-ai agent (migrate scout.ts)

**Files:**
- Create: `src/agents/tech-ai.ts`
- Delete: `src/scout.ts`

This replaces `scout.ts` with the tech-ai agent using `AgentConfig`.

- [ ] **Step 1: Write the failing test**

Create `tests/agents/tech-ai.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TECH_AI_CONFIG } from "../../src/agents/tech-ai.js";

describe("TECH_AI_CONFIG", () => {
  it("should have the correct agent name", () => {
    expect(TECH_AI_CONFIG.name).toBe("tech-ai");
  });

  it("should define 4 source fetchers", () => {
    expect(TECH_AI_CONFIG.sources).toHaveLength(4);
  });

  it("should have systemPrompt with AI/tech sections", () => {
    expect(TECH_AI_CONFIG.systemPrompt).toContain("À lire absolument");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("Nouveaux Outils");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("Tendances");
  });

  it("should have emailBranding for Agent Scout", () => {
    expect(TECH_AI_CONFIG.emailBranding.title).toBe("Agent Scout");
    expect(TECH_AI_CONFIG.emailBranding.subjectPrefix).toBe("Agent Scout");
  });
});
```

- [ ] **Step 2: Create `src/agents/tech-ai.ts`**

```typescript
import { fetchBluesky } from "../sources/fetch-bluesky.js";
import { fetchHackerNews } from "../sources/fetch-hackernews.js";
import { fetchReddit } from "../sources/fetch-reddit.js";
import { fetchTwitter } from "../sources/fetch-twitter.js";
import type { AgentConfig } from "../shared/types.js";

const BLUESKY_HASHTAGS = [
  "#vibecoding",
  "#vibecode",
  "#claudecode",
  "#claude",
  "#codex",
  "#IA",
];
const HN_QUERIES = ["AI", "LLM"];
const REDDIT_SUBREDDITS = [
  "MachineLearning",
  "LocalLLaMA",
  "ChatGPT",
  "ClaudeAI",
  "coding",
];
const REDDIT_KEYWORDS = ["AI", "LLM", "vibe coding", "Claude"];
const TWITTER_SEARCH_TERMS = ["#vibecoding", "#IA", "vibe coding", "AI tools"];

const SYSTEM_PROMPT = `Tu es Agent Scout, un analyste de veille technologique. Tu synthétises des contenus provenant de différentes sources web en un résumé structuré en HTML.

Tu DOIS produire du HTML pur — pas de markdown. Interdit d'utiliser **gras**, # titres, ou - listes markdown. Uniquement des balises HTML.

Le HTML produit sera inséré à l'intérieur d'une cellule <td> d'un email. Ne pas ajouter de <body>, <html> ni de marges globales. Ta réponse doit contenir UNIQUEMENT le HTML du contenu, sans <html>, <head> ou <body>.

Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.

N'invente JAMAIS de liens. Utilise uniquement les URLs fournies dans les contenus source.

Si plusieurs sources parlent du même sujet, fusionne-les en un seul item plutôt que de les lister séparément.

Utilise les scores (points Hacker News) pour hiérarchiser les contenus dans « À lire absolument » — les contenus les plus populaires en premier.

Structure obligatoire avec ces 3 sections :

1. **À lire absolument** — Les 3-5 contenus les plus importants ou impactants. Pour chaque contenu, inclus un lien cliquable et une phrase de contexte.

2. **Nouveaux Outils** — Outils, projets, librairies ou frameworks mentionnés. Inclus les liens quand disponibles.

3. **Tendances** — Tendances émergentes ou patterns récurrents observés dans les contenus. Chaque tendance DOIT citer ses sources entre parenthèses avec le nom de la source et un lien vers le contenu origine quand c'est pertinent.

Si une section n'a pas de contenu pertinent, affiche « Rien de notable cette fois-ci » plutôt que de forcer des items.

Format HTML requis :
- Utilise <h2> pour les sections avec style inline coloré
- Utilise <ul>/<li> pour les listes
- Chaque item doit avoir un <a href="..." style="color:#007AFF;text-decoration:none;font-weight:500;">lien</a> cliquable
- Ajoute une phrase de contexte après chaque lien
- Utilise <em> pour les noms d'auteurs/sources
- Pas de CSS classes, que des styles inline
- Style moderne et lisible, fond blanc, texte sombre

Exemple de sortie attendue :
<h2 style="font-size:20px;font-weight:700;color:#1c1c1e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e5ea;">À lire absolument</h2>
<ul style="padding-left:0;list-style:none;margin:0 0 28px;">
  <li style="margin-bottom:16px;"><a href="https://example.com/article" style="color:#007AFF;text-decoration:none;font-weight:500;">Titre de l'article</a><span style="color:#3c3c43;"> — Une phrase de contexte qui résume l'impact.</span> <em style="color:#8e8e93;font-size:13px;">(par auteur, Hacker News, 342 points)</em></li>
</ul>`;

export const TECH_AI_CONFIG: AgentConfig = {
  name: "tech-ai",
  sources: [
    () =>
      fetchBluesky(
        BLUESKY_HASHTAGS,
        process.env.BLUESKY_HANDLE,
        process.env.BLUESKY_APP_PASSWORD,
      ),
    () => fetchHackerNews(HN_QUERIES),
    () => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS),
    () =>
      fetchTwitter(TWITTER_SEARCH_TERMS, process.env.APIFY_API_KEY || ""),
  ],
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Agent Scout",
    subjectPrefix: "Agent Scout",
    footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
  },
};
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run tests/agents/tech-ai.test.ts`
Expected: PASS

- [ ] **Step 4: Delete old scout.ts and commit**

```bash
rm src/scout.ts
git add src/agents/tech-ai.ts tests/agents/tech-ai.test.ts
git rm src/scout.ts
git commit -m "refactor: migrate scout.ts to agents/tech-ai.ts with AgentConfig"
```

---

### Task 7: Create fetch-rss.ts — Generic RSS source module

**Files:**
- Create: `src/sources/fetch-rss.ts`
- Create: `tests/sources/fetch-rss.test.ts`

This is the only new source module. It fetches and parses RSS feeds, converting entries to `ContentItem`.

- [ ] **Step 1: Write the failing test**

Create `tests/sources/fetch-rss.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRss } from "../../src/sources/fetch-rss.js";

const LUXURY_DAILY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Luxury Daily</title>
    <item>
      <title>Dior launches AR try-on with Snapchat</title>
      <link>https://luxurydaily.com/dior-ar-snapchat</link>
      <description>Dior partners with Snap for virtual try-on experience targeting Gen Z luxury consumers.</description>
      <pubDate>Mon, 14 Apr 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Gucci AI lens campaign results</title>
      <link>https://luxurydaily.com/gucci-ai-lens</link>
      <description>Gucci reports 3x engagement with Sponsored AI Lens on Snapchat.</description>
      <pubDate>Mon, 14 Apr 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const EMPTY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

describe("fetchRss", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse RSS items into ContentItems", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(LUXURY_DAILY_RSS, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://luxurydaily.com/rss", label: "Luxury Daily" },
    ]);

    expect(result.source).toBe("Luxury Daily");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: "Dior launches AR try-on with Snapchat",
      url: "https://luxurydaily.com/dior-ar-snapchat",
      source: "Luxury Daily",
    });
  });

  it("should handle empty RSS feeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(EMPTY_RSS, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://example.com/rss", label: "Empty" },
    ]);

    expect(result.items).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("should merge multiple RSS feeds into one source", async () => {
    const feed1 = `<?xml version="1.0"?><rss version="2.0"><channel><title>F1</title><item><title>Item A</title><link>https://a.com</link><description>Desc A</description></item></channel></rss>`;
    const feed2 = `<?xml version="1.0"?><rss version="2.0"><channel><title>F2</title><item><title>Item B</title><link>https://b.com</link><description>Desc B</description></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(feed1, { status: 200 }))
      .mockResolvedValueOnce(new Response(feed2, { status: 200 }));

    const result = await fetchRss([
      { url: "https://f1.com/rss", label: "Combined" },
      { url: "https://f2.com/rss", label: "Combined" },
    ]);

    expect(result.source).toBe("Combined");
    expect(result.items).toHaveLength(2);
  });

  it("should deduplicate items by URL across feeds", async () => {
    const dupItem = `<?xml version="1.0"?><rss version="2.0"><channel><title>Dup</title><item><title>Dup</title><link>https://same.com</link><description>Same</description></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(dupItem, { status: 200 }))
      .mockResolvedValueOnce(new Response(dupItem, { status: 200 }));

    const result = await fetchRss([
      { url: "https://f1.com/rss", label: "Dedup" },
      { url: "https://f2.com/rss", label: "Dedup" },
    ]);

    expect(result.items).toHaveLength(1);
  });

  it("should handle failed feeds gracefully", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>OK</title><item><title>OK item</title><link>https://ok.com</link><description>Desc</description></item></channel></rss>`,
          { status: 200 },
        ),
      );

    const result = await fetchRss([
      { url: "https://bad.com/rss", label: "Partial" },
      { url: "https://ok.com/rss", label: "Partial" },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.error).toBeUndefined();
  });

  it("should set source label from feed config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(LUXURY_DAILY_RSS, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://luxurydaily.com/rss", label: "Luxury Daily RSS" },
    ]);

    expect(result.source).toBe("Luxury Daily RSS");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sources/fetch-rss.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/sources/fetch-rss.ts`**

```typescript
import type { SourceResult, ContentItem } from "../shared/types.js";

const TIMEOUT_MS = 10000;

interface RssFeedConfig {
  url: string;
  label: string;
}

function extractText(parent: Element, tagName: string): string {
  const el = parent.querySelector(tagName);
  return el?.textContent?.trim() || "";
}

function parseRssItems(xml: string): ContentItem[] {
  const items: ContentItem[] = [];

  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const rssItems = doc.querySelectorAll("item");

    for (const item of rssItems) {
      const title = extractText(item, "title");
      const url = extractText(item, "link");
      const summary = extractText(item, "description");
      const dateStr = extractText(item, "pubDate");

      if (!title || !url) continue;

      items.push({
        title,
        url,
        summary: summary || title,
        source: "RSS",
        date: dateStr ? new Date(dateStr).toISOString() : undefined,
      });
    }
  } catch {
    // XML parse failure — return empty
  }

  return items;
}

async function fetchSingleFeed(config: RssFeedConfig): Promise<ContentItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(config.url, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    return parseRssItems(xml);
  } catch {
    return [];
  }
}

export async function fetchRss(feeds: RssFeedConfig[]): Promise<SourceResult> {
  try {
    const results = await Promise.all(feeds.map(fetchSingleFeed));

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];

    for (const items of results) {
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    }

    const label = feeds[0]?.label || "RSS";

    return { source: label, items: allItems };
  } catch (err) {
    return {
      source: feeds[0]?.label || "RSS",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

**Wait — Node.js doesn't have DOMParser.** We need a lightweight XML parser. Add `fast-xml-parser` as dependency.

- [ ] **Step 4: Install fast-xml-parser**

Run: `npm install fast-xml-parser`

- [ ] **Step 5: Rewrite `src/sources/fetch-rss.ts` using fast-xml-parser**

```typescript
import { XMLParser } from "fast-xml-parser";
import type { SourceResult, ContentItem } from "../shared/types.js";

const TIMEOUT_MS = 10000;
const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "item",
});

interface RssFeedConfig {
  url: string;
  label: string;
}

function parseRssItems(xml: string): ContentItem[] {
  try {
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel || parsed?.feed;
    const rssItems: unknown[] = channel?.item || channel?.entry || [];

    return rssItems
      .map((entry: Record<string, unknown>): ContentItem | null => {
        const title = String(entry.title || "");
        const link =
          typeof entry.link === "object"
            ? String((entry.link as Record<string, string>)?.href || "")
            : String(entry.link || "");
        const description = String(entry.description || entry.summary || "");
        const pubDate = String(entry.pubDate || entry.published || entry.updated || "");

        if (!title || !link) return null;

        return {
          title,
          url: link,
          summary: description || title,
          source: "RSS",
          date: pubDate ? new Date(pubDate).toISOString() : undefined,
        };
      })
      .filter((item): item is ContentItem => item !== null);
  } catch {
    return [];
  }
}

async function fetchSingleFeed(config: RssFeedConfig): Promise<ContentItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(config.url, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    return parseRssItems(xml);
  } catch {
    return [];
  }
}

export async function fetchRss(feeds: RssFeedConfig[]): Promise<SourceResult> {
  try {
    const results = await Promise.all(feeds.map(fetchSingleFeed));

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];

    for (const items of results) {
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    }

    const label = feeds[0]?.label || "RSS";

    return { source: label, items: allItems };
  } catch (err) {
    return {
      source: feeds[0]?.label || "RSS",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 6: Update the test to work with fast-xml-parser (not DOMParser)**

The test structure remains the same since `fetchRss` is the public API. No changes needed.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/sources/fetch-rss.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/sources/fetch-rss.ts tests/sources/fetch-rss.test.ts package.json package-lock.json
git commit -m "feat: add fetch-rss module with fast-xml-parser"
```

---

### Task 8: Create the luxe-digital agent

**Files:**
- Create: `src/agents/luxe-digital.ts`
- Create: `tests/agents/luxe-digital.test.ts`

This is the new agent entry point with luxury-specific sources, system prompt, and branding.

- [ ] **Step 1: Write the failing test**

Create `tests/agents/luxe-digital.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { LUXE_DIGITAL_CONFIG } from "../../src/agents/luxe-digital.js";

describe("LUXE_DIGITAL_CONFIG", () => {
  it("should have the correct agent name", () => {
    expect(LUXE_DIGITAL_CONFIG.name).toBe("luxe-digital");
  });

  it("should define source fetchers", () => {
    expect(LUXE_DIGITAL_CONFIG.sources.length).toBeGreaterThanOrEqual(3);
  });

  it("should have systemPrompt with luxury-digital sections", () => {
    expect(LUXE_DIGITAL_CONFIG.systemPrompt).toContain("Activations Digitales");
    expect(LUXE_DIGITAL_CONFIG.systemPrompt).toContain("Marques");
    expect(LUXE_DIGITAL_CONFIG.systemPrompt).toContain("Outils");
  });

  it("should have emailBranding for Luxe Digital Scout", () => {
    expect(LUXE_DIGITAL_CONFIG.emailBranding.title).toBe("Luxe Digital Scout");
    expect(LUXE_DIGITAL_CONFIG.emailBranding.subjectPrefix).toBe("Luxe Digital");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agents/luxe-digital.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/agents/luxe-digital.ts`**

This file defines the luxe-digital agent config. The system prompt and source list are core design decisions — the `TODO(human)` placeholder is in the system prompt for the section definitions, since those are a key business-logic choice.

```typescript
import { fetchReddit } from "../sources/fetch-reddit.js";
import { fetchTwitter } from "../sources/fetch-twitter.js";
import { fetchRss } from "../sources/fetch-rss.js";
import type { AgentConfig } from "../shared/types.js";

const REDDIT_SUBREDDITS = [
  "marketing",
  "digital_marketing",
  "luxury",
  "augmentedReality",
  "ArtificialIntelligence",
];
const REDDIT_KEYWORDS = [
  "luxury digital",
  "AR filter",
  "digital activation",
  "AI agent",
  "brand experience",
];
const TWITTER_SEARCH_TERMS = [
  "#DigitalActivation",
  "#LuxuryTech",
  "#ARfilter",
  "#LuxuryMarketing",
  "#RetailTech",
];
const RSS_FEEDS = [
  {
    url: "https://www.luxurydaily.com/rss/feed/marketing-advertising/",
    label: "Luxury Daily",
  },
  {
    url: "https://luxuryroundtable.com/rss-feed/research/advertising-marketing/",
    label: "Luxury Daily",
  },
];

// TODO(human): Define the 3-4 section structure for the luxe-digital system prompt.
// Consider what matters most: activations, brand campaigns, AR/AI tools, trends?
const SYSTEM_PROMPT = `Tu es Luxe Digital Scout, un analyste spécialisé dans les activations digitales et le marketing du luxe. Tu synthétises des contenus en un résumé structuré en HTML.

Tu DOIS produire du HTML pur — pas de markdown. Interdit d'utiliser **gras**, # titres, ou - listes markdown. Uniquement des balises HTML.

Le HTML produit sera inséré à l'intérieur d'une cellule <td> d'un email. Ne pas ajouter de <body>, <html> ni de marges globales. Ta réponse doit contenir UNIQUEMENT le HTML du contenu, sans <html>, <head> ou <body>.

Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.

N'invente JAMAIS de liens. Utilise uniquement les URLs fournies dans les contenus source.

Si plusieurs sources parlent du même sujet, fusionne-les en un seul item plutôt que de les lister séparément.

Priorise les contenus liés aux activations digitales, filtres AR, agents IA pour le luxe, et opérations marketing digital des marques premium.

Structure obligatoire avec ces 3 sections :

1. **Activations Digitales** — Campagnes, activations, expériences immersives (AR, VR, pop-ups digitaux) des marques luxe et premium. Inclus liens et contexte.

2. **Outils & Innovations** — Nouveaux outils, plateformes, filtres AR, agents IA, technologies utilisées par le secteur luxe/marketing digital. Inclus les liens quand disponibles.

3. **Tendances** — Tendances émergentes du marketing digital luxe, patterns récurrents, retours sur campagnes. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, affiche « Rien de notable cette fois-ci » plutôt que de forcer des items.

Format HTML requis :
- Utilise <h2> pour les sections avec style inline coloré
- Utilise <ul>/<li> pour les listes
- Chaque item doit avoir un <a href="..." style="color:#007AFF;text-decoration:none;font-weight:500;">lien</a> cliquable
- Ajoute une phrase de contexte après chaque lien
- Utilise <em> pour les noms de sources
- Pas de CSS classes, que des styles inline
- Style moderne et lisible, fond blanc, texte sombre`;

export const LUXE_DIGITAL_CONFIG: AgentConfig = {
  name: "luxe-digital",
  sources: [
    () => fetchRss(RSS_FEEDS),
    () => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS),
    () =>
      fetchTwitter(TWITTER_SEARCH_TERMS, process.env.APIFY_API_KEY || ""),
  ],
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Luxe Digital Scout",
    subjectPrefix: "Luxe Digital",
    footerSources: "Luxury Daily · Luxury Roundtable · Reddit · X/Twitter",
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/agents/luxe-digital.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/luxe-digital.ts tests/agents/luxe-digital.test.ts
git commit -m "feat: add luxe-digital agent with RSS, Reddit, Twitter sources"
```

---

### Task 9: Create the CLI dispatcher and runAgent function

**Files:**
- Create: `src/index.ts`
- Create: `src/shared/run-agent.ts`
- Create: `tests/agents/run-agent.test.ts`

The `runAgent()` function contains the shared orchestration logic (previously in `scout.ts`). `src/index.ts` is the CLI entry point that dispatches based on `--agent` flag.

- [ ] **Step 1: Write the failing test for runAgent**

Create `tests/agents/run-agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent } from "../../src/shared/run-agent.js";
import type { AgentConfig, SourceResult } from "../../src/shared/types.js";

const MOCK_CONFIG: AgentConfig = {
  name: "test-agent",
  sources: [
    async () =>
      ({
        source: "Test Source",
        items: [
          {
            title: "Test Item",
            url: "https://example.com",
            summary: "Test summary",
            source: "Test Source",
          },
        ],
      }) as SourceResult,
  ],
  systemPrompt: "Tu es un agent de test.",
  emailBranding: {
    title: "Test Agent",
    subjectPrefix: "Test",
    footerSources: "Test Source",
  },
};

describe("runAgent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.VPS_URL = "http://localhost:3000";
    process.env.API_KEY = "test-key";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_TO = "test@example.com";
    process.env.RESEND_FROM = "test@resend.dev";
  });

  it("should return error when no content fetched", async () => {
    const emptyConfig: AgentConfig = {
      ...MOCK_CONFIG,
      sources: [
        async () => ({ source: "Empty", items: [] }) as SourceResult,
      ],
    };

    const result = await runAgent(emptyConfig);

    expect(result.success).toBe(false);
    expect(result.emailSent).toBe(false);
  });

  it("should call synthesize with the agent's systemPrompt", async () => {
    const mockHtml =
      '<h2 style="font-size:20px;">Test Section</h2><p>Content</p>';
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: mockHtml }), { status: 200 }),
    );

    vi.mock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({
        emails: {
          send: vi
            .fn()
            .mockResolvedValue({ data: { id: "email-123" }, error: null }),
        },
      })),
    }));

    const result = await runAgent(MOCK_CONFIG);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.systemPrompt).toBe("Tu es un agent de test.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/agents/run-agent.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `src/shared/run-agent.ts`**

```typescript
import { synthesize } from "./synthesize.js";
import { buildEmailHtml, makeEmailSubject, sendEmail } from "./send-email.js";
import type { AgentConfig, ScoutResult, SourceResult } from "./types.js";

export async function runAgent(config: AgentConfig): Promise<ScoutResult> {
  console.log(`[${config.emailBranding.title}] Starting run...`);
  const startTime = Date.now();

  // 1. Fetch all sources in parallel
  console.log(`[${config.emailBranding.title}] Fetching sources...`);
  const results = await Promise.allSettled(config.sources.map((fn) => fn()));

  const sources: SourceResult[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      source: `Source ${index + 1}`,
      items: [],
      error: result.reason?.message || String(result.reason),
    };
  });

  const sourcesFetched = sources.filter((s) => !s.error).length;
  const sourcesFailed = sources.filter((s) => s.error).length;

  console.log(
    `[${config.emailBranding.title}] Fetched: ${sourcesFetched} success, ${sourcesFailed} failed in ${Date.now() - startTime}ms`,
  );

  // 2. Check if we have any content
  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);
  if (totalItems === 0) {
    console.error(
      `[${config.emailBranding.title}] No content fetched from any source. Skipping email.`,
    );
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["No content fetched from any source"],
    };
  }

  // 3. Synthesize with Ollama
  console.log(`[${config.emailBranding.title}] Synthesizing with Ollama...`);
  const vpsUrl = process.env.VPS_URL;
  if (!vpsUrl) {
    console.error(`[${config.emailBranding.title}] Missing VPS_URL`);
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["Missing VPS_URL"],
    };
  }

  let htmlContent: string;
  try {
    htmlContent = await synthesize(sources, vpsUrl, config.systemPrompt, process.env.API_KEY);
  } catch (err) {
    console.error(`[${config.emailBranding.title}] Ollama synthesis failed:`, err);
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: [
        `Ollama synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // 4. Build and send email
  console.log(`[${config.emailBranding.title}] Sending email via Resend...`);
  const now = new Date();
  const subject = makeEmailSubject(now, config.emailBranding);
  const emailHtml = buildEmailHtml(htmlContent, now, config.emailBranding);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
  const resendTo = process.env.RESEND_TO;

  if (!resendApiKey || !resendTo) {
    console.error(`[${config.emailBranding.title}] Missing RESEND_API_KEY or RESEND_TO`);
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["Missing Resend configuration"],
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
  console.log(`[${config.emailBranding.title}] Run completed in ${elapsed}ms`);

  return {
    success: emailResult.success,
    sourcesFetched,
    sourcesFailed,
    emailSent: emailResult.success,
    errors: [
      ...sources.filter((s) => s.error).map((s) => `${s.source}: ${s.error}`),
      ...(emailResult.error ? [`Resend: ${emailResult.error}`] : []),
    ],
  };
}
```

- [ ] **Step 4: Create `src/index.ts` — CLI dispatcher**

```typescript
import { TECH_AI_CONFIG } from "./agents/tech-ai.js";
import { LUXE_DIGITAL_CONFIG } from "./agents/luxe-digital.js";
import { runAgent } from "./shared/run-agent.js";

const AGENTS: Record<string, typeof TECH_AI_CONFIG> = {
  "tech-ai": TECH_AI_CONFIG,
  "luxe-digital": LUXE_DIGITAL_CONFIG,
};

const agentName = process.argv[2]?.replace(/^--agent=/, "") || "tech-ai";

if (!AGENTS[agentName]) {
  console.error(
    `Unknown agent: "${agentName}". Available: ${Object.keys(AGENTS).join(", ")}`,
  );
  process.exit(1);
}

const config = AGENTS[agentName];

runAgent(config)
  .then((result) => {
    console.log(
      `[${config.emailBranding.title}] Result:`,
      JSON.stringify(result, null, 2),
    );
    process.exit(result.success ? 0 : 1);
  })
  .catch((err) => {
    console.error(`[${config.emailBranding.title}] Fatal error:`, err);
    process.exit(1);
  });
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/shared/run-agent.ts tests/agents/run-agent.test.ts
git commit -m "feat: add CLI dispatcher and shared runAgent function"
```

---

### Task 10: Update package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update scripts in package.json**

```json
{
  "scripts": {
    "build": "tsc",
    "start": "tsx --env-file=.env src/index.ts --agent=tech-ai",
    "start:luxe": "tsx --env-file=.env src/index.ts --agent=luxe-digital",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Verify both agents can be invoked**

Run: `npx tsx --env-file=.env src/index.ts --agent=tech-ai` (should log and run tech-ai agent)
Run: `npx tsx --env-file=.env src/index.ts --agent=luxe-digital` (should log and run luxe-digital agent)

Both should output their respective branding in logs.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add start:luxe script and --agent flag"
```

---

### Task 11: Update tsconfig.json and verify build

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Verify tsconfig.json includes new directories**

The existing config uses `"include": ["src/**/*", "netlify/**/*", "tests/**/*"]` which already covers `src/shared/`, `src/sources/`, `src/agents/`. No change needed.

- [ ] **Step 2: Run TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

If there are import path errors, fix them. The key imports to verify:
- `src/agents/tech-ai.ts` imports from `../sources/` and `../shared/`
- `src/agents/luxe-digital.ts` imports from `../sources/` and `../shared/`
- `src/sources/*.ts` import from `../shared/`
- `src/shared/*.ts` import from `./` (same directory)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve import paths after restructuring"
```

---

### Task 12: Update CLAUDE.md with new architecture

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Architecture section in CLAUDE.md**

Update the architecture docs to reflect:
- New `src/shared/`, `src/sources/`, `src/agents/` directory structure
- Two agents: tech-ai and luxe-digital
- CLI dispatcher: `--agent` flag
- New `fetch-rss.ts` source module
- `AgentConfig` type for agent configuration

Key additions to document:
- `npm run start` → tech-ai agent
- `npm run start:luxe` → luxe-digital agent
- `src/agents/luxe-digital.ts` sources: RSS (Luxury Daily, Luxury Roundtable), Reddit (marketing, luxury, AR), Twitter/X
- `fetch-rss.ts` uses `fast-xml-parser`

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with multi-agent architecture"
```

---

## Self-Review Checklist

- [ ] **Spec coverage:** Each requirement from the conversation is covered:
  - Shared code (types, synthesize, email) → Tasks 1, 3, 4
  - 2 entry points (tech-ai, luxe-digital) → Tasks 6, 8
  - RSS source module → Task 7
  - Configurable prompts/branding → Tasks 3, 4, 6, 8
  - CLI dispatcher → Task 9
  - Package scripts → Task 10
  - Build verification → Task 11
  - Documentation → Task 12

- [ ] **Placeholder scan:** No TBD, TODO (except the intentional TODO(human) for the luxe-digital system prompt), no "add appropriate error handling", no "similar to Task N"

- [ ] **Type consistency:** `AgentConfig` is defined in Task 1 and used consistently in Tasks 6, 8, 9. `EmailBranding` is defined in Task 1 and used in Tasks 4, 6, 8. `synthesize()` signature in Task 3 matches calls in Task 9. `buildEmailHtml()` and `makeEmailSubject()` signatures in Task 4 match calls in Task 9.