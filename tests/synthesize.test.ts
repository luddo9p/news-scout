import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildPrompt, synthesize } from "../src/synthesize.js";
import type { SourceResult } from "../src/types.js";

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () =>
            '<h2 style="font-size:20px;">À lire absolument</h2><p>Test content</p>',
        },
      }),
    }),
  })),
}));

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
  it("should call Gemini API and return HTML content", async () => {
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
      "fake-gemini-key",
    );

    expect(result).toContain("À lire absolument");
  });
});
