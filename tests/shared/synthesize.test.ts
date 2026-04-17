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
      [{ source: "Test", items: [{ title: "Test", url: "https://example.com", summary: "Test", source: "Test" }] }],
      "http://localhost:3000",
      CUSTOM_SYSTEM_PROMPT,
      "test-api-key",
    );
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe("À lire absolument");
  });

  it("should retry once on invalid JSON then succeed", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: "not valid json" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
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