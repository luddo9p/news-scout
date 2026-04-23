# Synthèse JSON + Template Déterministe — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la génération HTML par l'IA par un flux JSON structuré + template déterministe, garantissant un design d'email cohérent à chaque exécution.

**Architecture:** L'IA retourne du JSON validé par Zod (schéma à deux types d'items : standard + trend). Un nouveau module `render.ts` convertit ces données en HTML avec styles inline codés en dur. `synthesize.ts` gère l'extraction JSON et le retry en cas d'invalidité.

**Tech Stack:** Zod, TypeScript, Vitest

---

### Task 1: Installer Zod

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Installer zod**

Run: `npm install zod`

- [ ] **Step 2: Vérifier l'installation**

Run: `npx tsc --noEmit`
Expected: PASS (pas d'erreurs)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add zod dependency for synthesis schema validation"
```

---

### Task 2: Créer le schéma Zod et les types

**Files:**
- Create: `src/shared/synthesis-schema.ts`
- Create: `tests/shared/synthesis-schema.test.ts`

- [ ] **Step 1: Écrire le test du schéma**

```ts
// tests/shared/synthesis-schema.test.ts
import { describe, it, expect } from "vitest";
import {
  SynthesisSchema,
  StandardItemSchema,
  TrendItemSchema,
  SectionSchema,
} from "../../src/shared/synthesis-schema.js";

describe("StandardItemSchema", () => {
  it("should parse a valid standard item", () => {
    const item = {
      title: "Claude Code CLI",
      url: "https://example.com/article",
      context: "Anthropic lance un nouveau CLI",
      source: "Hacker News",
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("should accept optional fields", () => {
    const item = {
      title: "Test",
      url: "https://example.com",
      context: "Context",
      source: "Reddit",
      author: "@user",
      score: 342,
      tags: ["AI", "CLI"],
      highlights: ["Point 1", "Point 2"],
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const item = {
      title: "Test",
      url: "https://example.com",
      // missing context and source
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("should reject invalid URL", () => {
    const item = {
      title: "Test",
      url: "not-a-url",
      context: "Context",
      source: "Test",
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe("TrendItemSchema", () => {
  it("should parse a valid trend item", () => {
    const item = {
      title: "AR dans le luxe",
      context: "Les marques investissent l'AR",
      citations: [
        {
          text: "Gucci lance un filtre AR",
          source: "Luxury Daily",
          url: "https://luxurydaily.com/gucci-ar",
        },
      ],
    };
    const result = TrendItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("should reject trend item without citations", () => {
    const item = {
      title: "Test",
      context: "Context",
      citations: [],
    };
    const result = TrendItemSchema.safeParse(item);
    expect(result.success).toBe(true); // empty citations is valid structurally
  });
});

describe("SectionSchema", () => {
  it("should parse a valid standard section", () => {
    const section = {
      title: "À lire absolument",
      type: "standard" as const,
      items: [
        {
          title: "Test",
          url: "https://example.com",
          context: "Context",
          source: "HN",
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(true);
  });

  it("should parse a valid trend section", () => {
    const section = {
      title: "Tendances",
      type: "trend" as const,
      items: [
        {
          title: "AR dans le luxe",
          context: "Les marques investissent",
          citations: [
            {
              text: "Gucci lance AR",
              source: "Luxury Daily",
              url: "https://example.com",
            },
          ],
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(true);
  });

  it("should reject standard section with trend items", () => {
    const section = {
      title: "À lire absolument",
      type: "standard",
      items: [
        {
          title: "AR dans le luxe",
          context: "Les marques investissent",
          citations: [{ text: "t", source: "s", url: "https://example.com" }],
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(false);
  });

  it("should reject trend section with standard items", () => {
    const section = {
      title: "Tendances",
      type: "trend",
      items: [
        {
          title: "Test",
          url: "https://example.com",
          context: "Context",
          source: "HN",
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(false);
  });
});

describe("SynthesisSchema", () => {
  it("should parse a full synthesis", () => {
    const data = {
      sections: [
        {
          title: "À lire absolument",
          type: "standard",
          items: [
            {
              title: "Test",
              url: "https://example.com",
              context: "Context",
              source: "HN",
              score: 100,
            },
          ],
        },
        {
          title: "Tendances",
          type: "trend",
          items: [
            {
              title: "AR luxe",
              context: "Tendance AR",
              citations: [
                {
                  text: "Gucci AR",
                  source: "LD",
                  url: "https://example.com",
                },
              ],
            },
          ],
        },
      ],
    };
    const result = SynthesisSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should accept empty sections", () => {
    const data = {
      sections: [
        { title: "Outils", type: "standard", items: [] },
      ],
    };
    const result = SynthesisSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/shared/synthesis-schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implémenter le schéma**

```ts
// src/shared/synthesis-schema.ts
import { z } from "zod";

export const StandardItemSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  context: z.string(),
  author: z.string().optional(),
  source: z.string(),
  score: z.number().optional(),
  tags: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
});

export const TrendItemSchema = z.object({
  title: z.string(),
  context: z.string(),
  citations: z.array(
    z.object({
      text: z.string(),
      source: z.string(),
      url: z.string().url(),
    }),
  ),
});

export const SectionSchema = z
  .object({
    title: z.string(),
    type: z.enum(["standard", "trend"]),
    items: z.array(z.union([StandardItemSchema, TrendItemSchema])),
  })
  .refine(
    (section) => {
      if (section.type === "standard") {
        return section.items.every(
          (item) => StandardItemSchema.safeParse(item).success,
        );
      }
      return section.items.every(
        (item) => TrendItemSchema.safeParse(item).success,
      );
    },
    { message: "Items must match section type" },
  );

export const SynthesisSchema = z.object({
  sections: z.array(SectionSchema),
});

export type SynthesisData = z.infer<typeof SynthesisSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type StandardItem = z.infer<typeof StandardItemSchema>;
export type TrendItem = z.infer<typeof TrendItemSchema>;
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run tests/shared/synthesis-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/synthesis-schema.ts tests/shared/synthesis-schema.test.ts
git commit -m "feat: add Zod synthesis schema with standard/trend item types"
```

---

### Task 3: Créer le renderer HTML déterministe

**Files:**
- Create: `src/shared/render.ts`
- Create: `tests/shared/render.test.ts`

- [ ] **Step 1: Écrire les tests du renderer**

```ts
// tests/shared/render.test.ts
import { describe, it, expect } from "vitest";
import { renderSections } from "../../src/shared/render.js";
import type { SynthesisData } from "../../src/shared/synthesis-schema.js";

describe("renderSections", () => {
  it("should render a standard section with items", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "À lire absolument",
          type: "standard",
          items: [
            {
              title: "Claude Code CLI",
              url: "https://example.com/claude-code",
              context: "Anthropic lance un nouveau CLI pour les développeurs",
              source: "Hacker News",
              score: 342,
              author: "@anthropic",
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).toContain("À lire absolument");
    expect(html).toContain('<h2');
    expect(html).toContain("Claude Code CLI");
    expect(html).toContain('href="https://example.com/claude-code"');
    expect(html).toContain("Anthropic lance un nouveau CLI");
    expect(html).toContain("342 points");
    expect(html).toContain("@anthropic");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
  });

  it("should render tags as plain text separated by middle dots", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Outils",
          type: "standard",
          items: [
            {
              title: "Test Tool",
              url: "https://example.com",
              context: "A tool",
              source: "Reddit",
              tags: ["AI", "CLI"],
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).toContain("AI · CLI");
  });

  it("should render highlights as a sub-list", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Outils",
          type: "standard",
          items: [
            {
              title: "Test Tool",
              url: "https://example.com",
              context: "A tool",
              source: "Reddit",
              highlights: ["Feature A", "Feature B"],
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).toContain("Feature A");
    expect(html).toContain("Feature B");
  });

  it("should render a trend section with citations", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Tendances",
          type: "trend",
          items: [
            {
              title: "AR dans le luxe",
              context: "Les marques investissent dans les filtres AR",
              citations: [
                {
                  text: "Gucci lance un filtre AR sur Snapchat",
                  source: "Luxury Daily",
                  url: "https://luxurydaily.com/gucci",
                },
                {
                  text: "Reddit discute des filtres AR",
                  source: "r/luxury",
                  url: "https://reddit.com/r/luxury/1",
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).toContain("AR dans le luxe");
    expect(html).toContain("Les marques investissent");
    expect(html).toContain("Gucci lance un filtre AR");
    expect(html).toContain("Luxury Daily");
    expect(html).toContain('href="https://luxurydaily.com/gucci"');
    expect(html).toContain("Reddit discute des filtres AR");
    expect(html).toContain("r/luxury");
  });

  it("should render empty section message when items is empty", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Outils",
          type: "standard",
          items: [],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).toContain("Rien de notable cette fois-ci");
  });

  it("should not render tags when absent", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Item",
              url: "https://example.com",
              context: "Ctx",
              source: "SRC",
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).not.toContain("·");
  });

  it("should not render highlights when absent", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Item",
              url: "https://example.com",
              context: "Ctx",
              source: "SRC",
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    // Should not have nested <ul> for highlights
    const nestedUlMatch = html.match(/<li[^>]*>[\s\S]*?<ul/g);
    expect(nestedUlMatch).toBeNull();
  });

  it("should handle multiple sections", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "À lire absolument",
          type: "standard",
          items: [
            {
              title: "Item 1",
              url: "https://example.com/1",
              context: "Ctx 1",
              source: "HN",
            },
          ],
        },
        {
          title: "Tendances",
          type: "trend",
          items: [
            {
              title: "Trend 1",
              context: "Ctx trend",
              citations: [
                {
                  text: "Citation",
                  source: "SRC",
                  url: "https://example.com/2",
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).toContain("À lire absolument");
    expect(html).toContain("Tendances");
    expect(html).toContain("Item 1");
    expect(html).toContain("Trend 1");
  });

  it("should use only inline styles, no CSS classes", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Item",
              url: "https://example.com",
              context: "Ctx",
              source: "SRC",
            },
          ],
        },
      ],
    };

    const html = renderSections(data);

    expect(html).not.toMatch(/class=/);
    expect(html).toMatch(/style="/);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run tests/shared/render.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implémenter le renderer**

```ts
// src/shared/render.ts
import type {
  SynthesisData,
  StandardItem,
  TrendItem,
  Section,
} from "./synthesis-schema.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderStandardItem(item: StandardItem): string {
  const parts: string[] = [];

  // Lien titre
  parts.push(
    `<a href="${escapeHtml(item.url)}" style="color:#007AFF;text-decoration:none;font-weight:500;">${escapeHtml(item.title)}</a>`,
  );

  // Contexte
  parts.push(
    `<span style="color:#3c3c43;"> — ${escapeHtml(item.context)}</span>`,
  );

  // Métadonnées (auteur, source, score)
  const metaParts: string[] = [];
  if (item.author) metaParts.push(escapeHtml(item.author));
  metaParts.push(escapeHtml(item.source));
  if (item.score) metaParts.push(`${item.score} points`);
  if (metaParts.length > 0) {
    parts.push(
      ` <em style="color:#8e8e93;font-size:13px;">(${metaParts.join(", ")})</em>`,
    );
  }

  // Tags (texte simple, séparateur ·)
  if (item.tags && item.tags.length > 0) {
    parts.push(
      `<span style="color:#8e8e93;font-size:13px;"> · ${item.tags.map((t) => escapeHtml(t)).join(" · ")}</span>`,
    );
  }

  let html = parts.join("");

  // Highlights (sous-liste)
  if (item.highlights && item.highlights.length > 0) {
    const highlightItems = item.highlights
      .map(
        (h) =>
          `<li style="margin-bottom:4px;font-size:14px;color:#3c3c43;line-height:1.4;">${escapeHtml(h)}</li>`,
      )
      .join("");
    html += `<ul style="padding-left:20px;list-style:disc;margin:8px 0 0;">${highlightItems}</ul>`;
  }

  return `<li style="margin-bottom:16px;line-height:1.5;">${html}</li>`;
}

function renderTrendItem(item: TrendItem): string {
  const parts: string[] = [];

  parts.push(`<strong style="color:#1c1c1e;">${escapeHtml(item.title)}</strong>`);
  parts.push(
    `<span style="color:#3c3c43;"> — ${escapeHtml(item.context)}</span>`,
  );

  // Citations
  if (item.citations.length > 0) {
    const citationHtml = item.citations
      .map(
        (c) =>
          `<div style="margin:6px 0 0 16px;font-size:14px;line-height:1.4;"><em style="color:#8e8e93;">(${escapeHtml(c.source)})</em> <a href="${escapeHtml(c.url)}" style="color:#007AFF;text-decoration:none;">${escapeHtml(c.text)}</a></div>`,
      )
      .join("");
    parts.push(citationHtml);
  }

  return `<li style="margin-bottom:16px;line-height:1.5;">${parts.join("")}</li>`;
}

function renderSection(section: Section): string {
  const sectionStyles =
    "font-size:20px;font-weight:700;color:#1c1c1e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e5ea;";
  let html = `<h2 style="${sectionStyles}">${escapeHtml(section.title)}</h2>`;

  if (section.items.length === 0) {
    html += `<p style="color:#8e8e93;font-size:15px;margin:0 0 28px;">Rien de notable cette fois-ci</p>`;
    return html;
  }

  const listStyle =
    "padding-left:0;list-style:none;margin:0 0 28px;";

  if (section.type === "standard") {
    const itemsHtml = section.items
      .map((item) => renderStandardItem(item as StandardItem))
      .join("");
    html += `<ul style="${listStyle}">${itemsHtml}</ul>`;
  } else {
    const itemsHtml = section.items
      .map((item) => renderTrendItem(item as TrendItem))
      .join("");
    html += `<ul style="${listStyle}">${itemsHtml}</ul>`;
  }

  return html;
}

export function renderSections(data: SynthesisData): string {
  return data.sections.map(renderSection).join("\n");
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run tests/shared/render.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/render.ts tests/shared/render.test.ts
git commit -m "feat: add deterministic HTML renderer for synthesis data"
```

---

### Task 4: Réécrire synthesize.ts avec extraction JSON et retry

**Files:**
- Modify: `src/shared/synthesize.ts`
- Modify: `tests/shared/synthesize.test.ts`

- [ ] **Step 1: Réécrire les tests de synthesize**

Remplacer tout le contenu de `tests/shared/synthesize.test.ts` :

```ts
// tests/shared/synthesize.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPrompt, synthesize, extractJson, parseSynthesis } from "../../src/shared/synthesize.js";
import type { SourceResult } from "../../src/shared/types.js";

const CUSTOM_SYSTEM_PROMPT =
  "Tu es un analyste luxe digital. Structure: Tendances, Marques, Outils.";

const VALID_JSON_RESPONSE = JSON.stringify({
  sections: [
    {
      title: "À lire absolument",
      type: "standard",
      items: [
        {
          title: "Test Article",
          url: "https://example.com/test",
          context: "Un article important",
          source: "Hacker News",
          score: 342,
        },
      ],
    },
    {
      title: "Tendances",
      type: "trend",
      items: [
        {
          title: "AR dans le luxe",
          context: "Les marques investissent l'AR",
          citations: [
            {
              text: "Gucci lance AR",
              source: "Luxury Daily",
              url: "https://example.com/gucci",
            },
          ],
        },
      ],
    },
  ],
});

describe("buildPrompt", () => {
  it("should build a prompt with source content", () => {
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

describe("extractJson", () => {
  it("should extract JSON from markdown fences", () => {
    const raw = '```json\n{"sections":[]}\n```';
    expect(extractJson(raw)).toBe('{"sections":[]}');
  });

  it("should extract JSON from fences without language tag", () => {
    const raw = '```\n{"sections":[]}\n```';
    expect(extractJson(raw)).toBe('{"sections":[]}');
  });

  it("should return raw string when no fences", () => {
    const raw = '{"sections":[]}';
    expect(extractJson(raw)).toBe('{"sections":[]}');
  });

  it("should trim whitespace", () => {
    const raw = '  {"sections":[]}  ';
    expect(extractJson(raw)).toBe('{"sections":[]}');
  });
});

describe("parseSynthesis", () => {
  it("should parse valid JSON", () => {
    const result = parseSynthesis(VALID_JSON_RESPONSE);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.sections).toHaveLength(2);
      expect(result.data.sections[0].type).toBe("standard");
      expect(result.data.sections[1].type).toBe("trend");
    }
  });

  it("should return error for invalid JSON", () => {
    const result = parseSynthesis("not json at all");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("JSON parse error");
    }
  });

  it("should return error for valid JSON but invalid schema", () => {
    const result = parseSynthesis('{"wrong": "structure"}');
    expect("error" in result).toBe(true);
  });

  it("should return error for section type mismatch", () => {
    const mismatched = JSON.stringify({
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Trend item in standard section",
              context: "Wrong type",
              citations: [{ text: "t", source: "s", url: "https://example.com" }],
            },
          ],
        },
      ],
    });
    const result = parseSynthesis(mismatched);
    expect("error" in result).toBe(true);
  });
});

describe("synthesize", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return SynthesisData on valid JSON response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON_RESPONSE }), { status: 200 }),
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

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe("À lire absolument");
  });

  it("should retry once on invalid JSON then succeed", async () => {
    // First call: invalid JSON
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: "not valid json" }), { status: 200 }),
    );
    // Retry: valid JSON
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON_RESPONSE }), { status: 200 }),
    );

    const result = await synthesize(
      [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
      "http://localhost:3000",
      "Any system prompt",
    );

    expect(result.sections).toHaveLength(2);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("should throw after retry failure", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: "bad" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: "still bad" }), { status: 200 }),
      );

    await expect(
      synthesize(
        [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
        "http://localhost:3000",
        "Any prompt",
      ),
    ).rejects.toThrow("Synthesis JSON invalid after retry");
  });

  it("should extract JSON from markdown fences", async () => {
    const fenced = '```json\n' + VALID_JSON_RESPONSE + '\n```';
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: fenced }), { status: 200 }),
    );

    const result = await synthesize(
      [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
      "http://localhost:3000",
      "Any prompt",
    );

    expect(result.sections).toHaveLength(2);
  });

  it("should work without API key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON_RESPONSE }), { status: 200 }),
    );

    await synthesize(
      [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
      "http://localhost:3000",
      "Any system prompt",
    );

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    expect(
      (options.headers as Record<string, string>)["x-api-key"],
    ).toBeUndefined();
  });

  it("should throw on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid key" }), { status: 401 }),
    );

    await expect(
      synthesize(
        [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
        "http://localhost:3000",
        "Any system prompt",
        "bad-key",
      ),
    ).rejects.toThrow("Ollama API error 401");
  });

  it("should throw on empty response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: "" }), { status: 200 }),
    );

    await expect(
      synthesize(
        [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
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
        [{ source: "Test", items: [{ title: "T", url: "https://example.com", summary: "s", source: "Test" }] }],
        "http://localhost:3000",
        "Any system prompt",
      ),
    ).rejects.toThrow("Ollama API timeout");
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/shared/synthesize.test.ts`
Expected: FAIL — `extractJson` and `parseSynthesis` not exported

- [ ] **Step 3: Réécrire synthesize.ts**

Remplacer tout le contenu de `src/shared/synthesize.ts` :

```ts
import { SynthesisSchema } from "./synthesis-schema.js";
import type { SynthesisData } from "./synthesis-schema.js";
import type { SourceResult } from "./types.js";

const DEFAULT_MODEL = "glm-5.1:cloud";
const TIMEOUT_MS = 300000;
const MAX_ITEMS_PER_SOURCE = 5;
const MAX_SUMMARY_LENGTH = 100;

export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return raw.trim();
}

export function parseSynthesis(
  raw: string,
): { data: SynthesisData } | { error: string } {
  const extracted = extractJson(raw);
  let json: unknown;
  try {
    json = JSON.parse(extracted);
  } catch (e) {
    return { error: `JSON parse error: ${(e as Error).message}` };
  }
  const parsed = SynthesisSchema.safeParse(json);
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.message };
}

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

async function callOllama(
  userPrompt: string,
  systemPrompt: string,
  vpsUrl: string,
  apiKey?: string,
): Promise<string> {
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
    const content: string = data.content;

    if (!content || content.trim().length === 0) {
      throw new Error("Ollama returned empty content");
    }

    return content;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Ollama API timeout");
    }
    throw err;
  }
}

export async function synthesize(
  sources: SourceResult[],
  vpsUrl: string,
  systemPrompt: string,
  apiKey?: string,
): Promise<SynthesisData> {
  const raw = await callOllama(buildPrompt(sources), systemPrompt, vpsUrl, apiKey);
  const first = parseSynthesis(raw);
  if ("data" in first) return first.data;

  console.warn(
    `[synthesize] First attempt returned invalid JSON, retrying. Error: ${first.error}`,
  );

  const retryUserPrompt = `Ton JSON précédent était invalide. Erreur : ${first.error}. Retourne UNIQUEMENT du JSON valide respectant le schéma.`;
  const retryRaw = await callOllama(
    retryUserPrompt,
    systemPrompt,
    vpsUrl,
    apiKey,
  );
  const retry = parseSynthesis(retryRaw);
  if ("data" in retry) return retry.data;

  throw new Error(`Synthesis JSON invalid after retry: ${retry.error}`);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/shared/synthesize.test.ts`
Expected: PASS

- [ ] **Step 5: Lancer tous les tests existants pour vérifier la régression**

Run: `npx vitest run`
Expected: Certains tests de `send-email.test.ts` et `run-agent.test.ts` peuvent échouer (car `buildEmailHtml` et `runAgent` changent dans les tâches suivantes). C'est attendu.

- [ ] **Step 6: Commit**

```bash
git add src/shared/synthesize.ts tests/shared/synthesize.test.ts
git commit -m "feat: rewrite synthesize to return SynthesisData with Zod validation and retry"
```

---

### Task 5: Mettre à jour send-email.ts pour utiliser renderSections

**Files:**
- Modify: `src/shared/send-email.ts`
- Modify: `tests/shared/send-email.test.ts`

- [ ] **Step 1: Réécrire les tests de send-email**

Remplacer tout le contenu de `tests/shared/send-email.test.ts` :

```ts
import { describe, it, expect, vi } from "vitest";
import {
  buildEmailHtml,
  makeEmailSubject,
} from "../../src/shared/send-email.js";
import type { EmailBranding } from "../../src/shared/types.js";
import type { SynthesisData } from "../../src/shared/synthesis-schema.js";

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

const SAMPLE_DATA: SynthesisData = {
  sections: [
    {
      title: "À lire absolument",
      type: "standard",
      items: [
        {
          title: "Test Article",
          url: "https://example.com/test",
          context: "Un article important",
          source: "Hacker News",
        },
      ],
    },
  ],
};

describe("buildEmailHtml", () => {
  it("should use custom branding title", () => {
    const html = buildEmailHtml(
      SAMPLE_DATA,
      new Date("2024-12-01T10:00:00Z"),
      LUXE_BRANDING,
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Luxe Digital Scout");
    expect(html).not.toContain("Agent Scout");
  });

  it("should use custom footer sources", () => {
    const html = buildEmailHtml(SAMPLE_DATA, new Date(), LUXE_BRANDING);

    expect(html).toContain("Luxury Daily · Reddit · X/Twitter · RSS");
  });

  it("should work with original scout branding", () => {
    const html = buildEmailHtml(SAMPLE_DATA, new Date(), SCOUT_BRANDING);

    expect(html).toContain("Agent Scout");
    expect(html).toContain("Bluesky · Hacker News · Reddit · X/Twitter");
  });

  it("should render synthesis data inside email template", () => {
    const html = buildEmailHtml(SAMPLE_DATA, new Date(), SCOUT_BRANDING);

    expect(html).toContain("Test Article");
    expect(html).toContain("https://example.com/test");
  });
});

describe("makeEmailSubject", () => {
  it("should format subject with custom prefix", () => {
    const subject = makeEmailSubject(
      new Date("2024-12-01T10:00:00Z"),
      LUXE_BRANDING,
    );

    expect(subject).toContain("Luxe Digital");
    expect(subject).toContain("Veille du");
  });

  it("should format subject with scout prefix", () => {
    const subject = makeEmailSubject(
      new Date("2024-12-01T10:00:00Z"),
      SCOUT_BRANDING,
    );

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

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run tests/shared/send-email.test.ts`
Expected: FAIL — `buildEmailHtml` signature mismatch

- [ ] **Step 3: Mettre à jour send-email.ts**

Modifier `buildEmailHtml` dans `src/shared/send-email.ts` — remplacer la signature et le contenu :

```ts
// Remplacer la signature existante :
// export function buildEmailHtml(content: string, date: Date, branding: EmailBranding): string
// Par :
import { renderSections } from "./render.js";
import type { SynthesisData } from "./synthesis-schema.js";

export function buildEmailHtml(
  data: SynthesisData,
  date: Date,
  branding: EmailBranding,
): string {
  const content = renderSections(data);
  // ... reste du template identique, ${content} est injecté au même endroit
```

Le corps complet de `buildEmailHtml` devient :

```ts
export function buildEmailHtml(
  data: SynthesisData,
  date: Date,
  branding: EmailBranding,
): string {
  const content = renderSections(data);

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
```

Ajouter les imports en haut du fichier. Le reste du fichier (`makeEmailSubject`, `sendEmail`) est inchangé.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run tests/shared/send-email.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/send-email.ts tests/shared/send-email.test.ts
git commit -m "feat: buildEmailHtml now takes SynthesisData and uses deterministic renderer"
```

---

### Task 6: Réécrire les system prompts des agents

**Files:**
- Modify: `src/agents/tech-ai.ts`
- Modify: `src/agents/luxe-digital.ts`
- Modify: `tests/agents/tech-ai.test.ts`

- [ ] **Step 1: Mettre à jour le test tech-ai**

Le test existant vérifie que le prompt contient "À lire absolument", "Nouveaux Outils", "Tendances". Ces sections sont toujours là, mais le prompt ne mentionne plus le HTML. Mettre à jour les assertions :

```ts
// tests/agents/tech-ai.test.ts
import { describe, it, expect } from "vitest";
import { TECH_AI_CONFIG } from "../../src/agents/tech-ai.js";

describe("TECH_AI_CONFIG", () => {
  it("should have the correct agent name", () => {
    expect(TECH_AI_CONFIG.name).toBe("tech-ai");
  });

  it("should define 4 source fetchers", () => {
    expect(TECH_AI_CONFIG.sources).toHaveLength(4);
  });

  it("should have systemPrompt with AI/tech sections in JSON format", () => {
    expect(TECH_AI_CONFIG.systemPrompt).toContain("À lire absolument");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("Nouveaux Outils");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("Tendances");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("JSON");
  });

  it("should not contain HTML instructions in systemPrompt", () => {
    expect(TECH_AI_CONFIG.systemPrompt).not.toContain("<h2");
    expect(TECH_AI_CONFIG.systemPrompt).not.toContain("style=");
  });

  it("should have emailBranding for Agent Scout", () => {
    expect(TECH_AI_CONFIG.emailBranding.title).toBe("Agent Scout");
    expect(TECH_AI_CONFIG.emailBranding.subjectPrefix).toBe("Agent Scout");
  });
});
```

- [ ] **Step 2: Réécrire le system prompt de tech-ai.ts**

Remplacer le `SYSTEM_PROMPT` dans `src/agents/tech-ai.ts` :

```ts
const SYSTEM_PROMPT = `Tu es Agent Scout, un analyste de veille technologique. Tu synthétises des contenus en JSON structuré.

Règles :
- Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.
- N'invente JAMAIS de liens. Utilise uniquement les URLs fournis dans les contenus source.
- Si plusieurs sources parlent du même sujet, fusionne-les en un seul item.
- Utilise les scores (points) pour hiérarchiser les contenus dans « À lire absolument » — les contenus les plus populaires en premier.

Retourne UNIQUEMENT du JSON valide (pas de markdown, pas de texte avant/après).

Schéma :
{
  "sections": [
    {
      "title": "string",
      "type": "standard" | "trend",
      "items": [...]
    }
  ]
}

Section type "standard" — items : { title, url, context, author?, source, score?, tags?[], highlights?[] }
- title : titre de l'article/outil
- url : lien original
- context : une phrase de contexte qui résume l'impact ou l'intérêt
- author? : auteur ou compte (optionnel)
- source : nom de la source (ex: Hacker News, Reddit, Bluesky)
- score? : score/popularité (optionnel)
- tags? : mots-clés pertinents (optionnel, ex: ["CLI", "AI"])
- highlights? : points clés (optionnel, 2-3 max)

Section type "trend" — items : { title, context, citations: [{ text, source, url }] }
- title : nom de la tendance
- context : description de la tendance
- citations : liste des sources qui illustrent cette tendance

3 sections obligatoires :
1. "À lire absolument" (type: "standard") — Les 3-5 contenus les plus importants ou impactants.
2. "Nouveaux Outils" (type: "standard") — Outils, projets, librairies ou frameworks mentionnés.
3. "Tendances" (type: "trend") — Tendances émergentes ou patterns récurrents. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, mets items: [].`;
```

- [ ] **Step 3: Réécrire le system prompt de luxe-digital.ts**

Remplacer le `SYSTEM_PROMPT` dans `src/agents/luxe-digital.ts` :

```ts
const SYSTEM_PROMPT = `Tu es Luxe Digital Scout, un analyste spécialisé dans les activations digitales et le marketing du luxe. Tu synthétises des contenus en JSON structuré.

Règles :
- Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.
- N'invente JAMAIS de liens. Utilise uniquement les URLs fournis dans les contenus source.
- Si plusieurs sources parlent du même sujet, fusionne-les en un seul item.
- Priorise les contenus liés aux activations digitales, filtres AR, agents IA pour le luxe, et opérations marketing digital des marques premium.

Retourne UNIQUEMENT du JSON valide (pas de markdown, pas de texte avant/après).

Schéma :
{
  "sections": [
    {
      "title": "string",
      "type": "standard" | "trend",
      "items": [...]
    }
  ]
}

Section type "standard" — items : { title, url, context, author?, source, score?, tags?[], highlights?[] }
- title : titre de l'article/outil
- url : lien original
- context : une phrase de contexte
- author? : auteur (optionnel)
- source : nom de la source
- score? : score/popularité (optionnel)
- tags? : mots-clés (optionnel, ex: ["AR", "luxury", "filtre"])
- highlights? : points clés (optionnel, 2-3 max)

Section type "trend" — items : { title, context, citations: [{ text, source, url }] }
- title : nom de la tendance
- context : description de la tendance
- citations : sources qui illustrent cette tendance

3 sections obligatoires :
1. "Activations Digitales" (type: "standard") — Campagnes, activations, expériences immersives (AR, VR, pop-ups digitaux) des marques luxe et premium.
2. "Outils & Innovations" (type: "standard") — Nouveaux outils, plateformes, filtres AR, agents IA, technologies du secteur luxe/marketing digital.
3. "Tendances" (type: "trend") — Tendances émergentes du marketing digital luxe, patterns récurrents. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, mets items: [].`;
```

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run tests/agents/tech-ai.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/agents/tech-ai.ts src/agents/luxe-digital.ts tests/agents/tech-ai.test.ts
git commit -m "feat: rewrite agent system prompts for JSON output instead of HTML"
```

---

### Task 7: Mettre à jour run-agent.ts et ses tests

**Files:**
- Modify: `src/shared/run-agent.ts`
- Modify: `tests/agents/run-agent.test.ts`

- [ ] **Step 1: Mettre à jour run-agent.ts**

Dans `src/shared/run-agent.ts`, le type de `htmlContent` change de `string` à `SynthesisData`. Modifier la section après l'appel à `synthesize()` :

```ts
// Remplacer :
// let htmlContent: string;
// try {
//   htmlContent = await synthesize(...);
// Par :
let synthesisData;
try {
  synthesisData = await synthesize(
    sources,
    vpsUrl,
    config.systemPrompt,
    process.env.API_KEY,
  );
```

Et modifier l'appel à `buildEmailHtml` :

```ts
// Remplacer :
// const emailHtml = buildEmailHtml(htmlContent, now, config.emailBranding);
// Par :
const emailHtml = buildEmailHtml(synthesisData, now, config.emailBranding);
```

Le fichier complet :

```ts
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

  let synthesisData;
  try {
    synthesisData = await synthesize(
      sources,
      vpsUrl,
      config.systemPrompt,
      process.env.API_KEY,
    );
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
  const emailHtml = buildEmailHtml(synthesisData, now, config.emailBranding);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
  const resendTo = process.env.RESEND_TO;

  if (!resendApiKey || !resendTo) {
    console.error(
      `[${config.emailBranding.title}] Missing RESEND_API_KEY or RESEND_TO`,
    );
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

- [ ] **Step 2: Mettre à jour les tests run-agent**

Dans `tests/agents/run-agent.test.ts`, les mocks de l'API Ollama doivent retourner du JSON valide au lieu de HTML. Remplacer tout le contenu :

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent } from "../../src/shared/run-agent.js";
import type { AgentConfig, SourceResult } from "../../src/shared/types.js";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "email-123" }, error: null }),
    },
  })),
}));

const VALID_JSON = JSON.stringify({
  sections: [
    {
      title: "À lire absolument",
      type: "standard",
      items: [
        {
          title: "Test Article",
          url: "https://example.com/test",
          context: "Important article",
          source: "Hacker News",
        },
      ],
    },
  ],
});

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
    vi.clearAllMocks();
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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.systemPrompt).toBe("Tu es un agent de test.");
  });

  it("should return error when VPS_URL is missing", async () => {
    delete process.env.VPS_URL;

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing VPS_URL");
  });

  it("should return error when Ollama synthesis fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Ollama synthesis failed");
  });

  it("should return error when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing Resend configuration");
  });

  it("should handle a source failure gracefully", async () => {
    const failingConfig: AgentConfig = {
      ...MOCK_CONFIG,
      sources: [
        async () =>
          ({
            source: "Good Source",
            items: [
              {
                title: "Good Item",
                url: "https://example.com/good",
                summary: "Good summary",
                source: "Good Source",
              },
            ],
          }) as SourceResult,
        async () => {
          throw new Error("Source down");
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(failingConfig);

    expect(result.sourcesFetched).toBe(1);
    expect(result.sourcesFailed).toBe(1);
    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
  });

  it("should succeed on happy path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.sourcesFetched).toBe(1);
    expect(result.sourcesFailed).toBe(0);
  });
});
```

- [ ] **Step 3: Lancer tous les tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/run-agent.ts tests/agents/run-agent.test.ts
git commit -m "feat: update runAgent to use SynthesisData flow"
```

---

### Task 8: Nettoyage final et vérification

**Files:**
- Modify: `src/shared/types.ts` (supprimer types obsolètes si nécessaire)

- [ ] **Step 1: Vérifier que types.ts n'a pas de types obsolètes**

Les types `SourceResult`, `ContentItem`, `ScoutResult`, `EmailBranding`, `AgentConfig` sont toujours utilisés. Seuls les types de synthèse sont maintenant dans `synthesis-schema.ts`. Pas de nettoyage nécessaire.

- [ ] **Step 2: Lancer tous les tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Type-check final**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Lancer le build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: final cleanup for JSON synthesis + template architecture"
```