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
