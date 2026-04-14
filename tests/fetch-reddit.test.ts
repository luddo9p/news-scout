import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchReddit } from "../src/fetch-reddit.js";

describe("fetchReddit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should search subreddits and return ContentItems", async () => {
    const mockResponse = {
      data: {
        children: [
          {
            data: {
              id: "abc123",
              title: "New LLM benchmark results",
              url: "https://example.com/benchmark",
              selftext: "Interesting findings about LLM performance",
              author: "researcher",
              score: 256,
              num_comments: 42,
              created_utc: 1701388800,
              subreddit: "MachineLearning",
              permalink:
                "/r/MachineLearning/comments/abc123/new_llm_benchmark/",
            },
          },
        ],
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchReddit(["MachineLearning"], ["AI", "LLM"]);

    expect(result.source).toBe("Reddit");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "New LLM benchmark results",
      url: "https://example.com/benchmark",
      source: "Reddit",
      author: "researcher",
      score: 256,
    });
    // Verify 24h date filter (t=day) is applied
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("t=day");
    expect(calledUrl).not.toContain("t=week");
  });

  it("should deduplicate posts across subreddits", async () => {
    const samePost = {
      id: "dup1",
      title: "Duplicate post",
      url: "https://example.com/dup",
      selftext: "",
      author: "user",
      score: 10,
      num_comments: 2,
      created_utc: 1701388800,
      subreddit: "MachineLearning",
      permalink: "/r/MachineLearning/comments/dup1/duplicate_post/",
    };

    // Same post returned from two subreddits
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { children: [{ data: samePost }] } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { children: [{ data: samePost }] } }),
          { status: 200 },
        ),
      );

    const result = await fetchReddit(["MachineLearning", "LocalLLaMA"], ["AI"]);

    expect(result.items).toHaveLength(1);
  });

  it("should use permalink for self posts", async () => {
    const mockResponse = {
      data: {
        children: [
          {
            data: {
              id: "self1",
              title: "Discussion thread",
              url: "/r/MachineLearning/comments/self1/discussion/",
              selftext: "What do you think about...",
              author: "poster",
              score: 50,
              num_comments: 20,
              created_utc: 1701388800,
              subreddit: "MachineLearning",
              permalink: "/r/MachineLearning/comments/self1/discussion/",
            },
          },
        ],
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchReddit(["MachineLearning"], ["AI"]);

    expect(result.items[0].url).toBe(
      "https://www.reddit.com/r/MachineLearning/comments/self1/discussion/",
    );
  });

  it("should skip failed subreddits and continue", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              children: [
                {
                  data: {
                    id: "ok1",
                    title: "Working post",
                    url: "https://example.com/ok",
                    selftext: "",
                    author: "user",
                    score: 5,
                    num_comments: 1,
                    created_utc: 1701388800,
                    subreddit: "LocalLLaMA",
                    permalink: "/r/LocalLLaMA/comments/ok1/working_post/",
                  },
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const result = await fetchReddit(["MachineLearning", "LocalLLaMA"], ["AI"]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Working post");
    expect(result.error).toBeUndefined();
  });

  it("should return empty items when all subreddits fail", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await fetchReddit(["MachineLearning"], ["AI"]);

    expect(result.items).toHaveLength(0);
    // Individual fetch errors are swallowed — only top-level errors surface
    expect(result.error).toBeUndefined();
  });
});
