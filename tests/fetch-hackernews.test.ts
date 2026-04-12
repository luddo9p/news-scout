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
