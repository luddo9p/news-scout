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

  it("should include anti-hallucination and language rules", () => {
    const sources: SourceResult[] = [
      {
        source: "Test",
        items: [
          {
            title: "Item",
            url: "https://example.com",
            summary: "Test",
            source: "Test",
          },
        ],
      },
    ];

    const prompt = buildPrompt(sources);

    expect(prompt).toContain("N'invente aucun lien");
    expect(prompt).toContain("Rédige en français");
    expect(prompt).toContain("fusionne-les en un seul item");
  });

  it("should include score information for prioritization", () => {
    const sources: SourceResult[] = [
      {
        source: "Hacker News",
        items: [
          {
            title: "Popular Story",
            url: "https://example.com/popular",
            summary: "Very popular",
            source: "Hacker News",
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

    // Only 5 items should appear (MAX_ITEMS_PER_SOURCE)
    const matches = prompt.match(/- \*\*Item \d+\*\*/g);
    expect(matches).toHaveLength(5);

    // Summaries should be truncated
    expect(prompt).toContain("...");
  });
});

describe("synthesize", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call VPS /generate and return HTML content", async () => {
    const mockResponse = {
      content:
        '<h2 style="font-size:20px;">À lire absolument</h2><p>Test content</p>',
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
      "test-api-key",
    );

    expect(result).toContain("À lire absolument");

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe("http://localhost:3000/generate");
    const options = fetchCall[1] as RequestInit;
    expect((options.headers as Record<string, string>)["x-api-key"]).toBe(
      "test-api-key",
    );
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("glm-5.1:cloud");
    expect(body.prompt).toBeDefined();
    expect(body.systemPrompt).toBeDefined();
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
    );

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    expect((options.headers as Record<string, string>)["x-api-key"]).toBe(
      undefined,
    );
  });

  it("should throw on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid key" }), {
        status: 401,
      }),
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
      ),
    ).rejects.toThrow("Ollama API timeout");
  });
});
