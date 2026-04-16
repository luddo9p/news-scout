import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPrompt, synthesize } from "../../src/shared/synthesize.js";
import type { SourceResult } from "../../src/shared/types.js";

const CUSTOM_SYSTEM_PROMPT =
  "Tu es un analyste luxe digital. Structure: Tendances, Marques, Outils.";

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
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: "" }), { status: 200 }),
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