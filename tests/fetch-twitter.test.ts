import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchTwitter } from "../src/fetch-twitter.js";

vi.mock("../src/date-filter.js", () => ({
  getSinceTimestamp: () => ({
    iso: "2024-04-13T00:00:00.000Z",
    unix: 1712966400,
    date: "2024-04-13",
  }),
}));

describe("fetchTwitter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should search tweets and return ContentItems", async () => {
    const mockTweets = [
      {
        url: "https://x.com/user/status/123",
        text: "Amazing AI tool released today!",
        author: { userName: "techuser", name: "Tech User" },
        likeCount: 150,
        createdAt: "Mon Dec 02 10:00:00 +0000 2024",
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockTweets), { status: 200 }),
    );

    const result = await fetchTwitter(["#vibecoding"], "fake-apify-key");

    expect(result.source).toBe("X/Twitter");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "Amazing AI tool released today!",
      url: "https://x.com/user/status/123",
      source: "X/Twitter",
      author: "techuser",
      score: 150,
    });
    // Verify 24h date filter (start param) is applied
    const requestInit = fetchSpy.mock.calls[0][1] as RequestInit;
    const requestBody = JSON.parse(requestInit.body as string);
    expect(requestBody).toHaveProperty("start", "2024-04-13");
  });

  it("should truncate long tweet text for title", async () => {
    const longText = "A".repeat(200);
    const mockTweets = [
      {
        url: "https://x.com/user/status/456",
        text: longText,
        author: { userName: "user2" },
        likeCount: 10,
        createdAt: "Tue Dec 03 12:00:00 +0000 2024",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockTweets), { status: 200 }),
    );

    const result = await fetchTwitter(["#IA"], "fake-apify-key");

    expect(result.items[0].title.length).toBeLessThanOrEqual(123); // 120 chars + "..."
    expect(result.items[0].summary).toBe(longText);
  });

  it("should parse Twitter date format to ISO", async () => {
    const mockTweets = [
      {
        url: "https://x.com/user/status/789",
        text: "Test tweet",
        author: { userName: "user3" },
        likeCount: 5,
        createdAt: "Fri Nov 24 17:49:36 +0000 2023",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockTweets), { status: 200 }),
    );

    const result = await fetchTwitter(["vibe coding"], "fake-apify-key");

    expect(result.items[0].date).toContain("2023-11-24");
  });

  it("should return error when Apify API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Invalid token" } }), {
        status: 401,
      }),
    );

    const result = await fetchTwitter(["#AI"], "invalid-key");

    expect(result.items).toHaveLength(0);
    expect(result.error).toContain("Invalid token");
  });

  it("should return error on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error"),
    );

    const result = await fetchTwitter(["#AI"], "fake-key");

    expect(result.items).toHaveLength(0);
    expect(result.error).toContain("Network error");
  });

  it("should filter out tweets without text or URL", async () => {
    const mockTweets = [
      { url: "https://x.com/user/status/1", text: "Valid tweet" },
      { url: "https://x.com/user/status/2", text: null },
      { url: "", text: "No URL tweet" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockTweets), { status: 200 }),
    );

    const result = await fetchTwitter(["test"], "fake-key");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Valid tweet");
  });
});
