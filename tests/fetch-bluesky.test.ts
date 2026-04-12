import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBluesky } from "../src/fetch-bluesky.js";

describe("fetchBluesky", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should search posts by hashtag and return ContentItems", async () => {
    const mockSearchResponse = {
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
      new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
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

  it("should authenticate before searching when credentials are provided", async () => {
    // Mock createSession call
    const mockSessionResponse = {
      accessJwt: "test-jwt-token",
      did: "did:plc:abc",
      handle: "test.bsky.social",
    };
    // Mock search call
    const mockSearchResponse = {
      posts: [
        {
          uri: "at://did:plc:abc/app.bsky.feed.post/456",
          author: { handle: "dev.bsky.social", displayName: "Dev" },
          record: {
            text: "Vibe coding is the future",
            createdAt: "2024-12-01T12:00:00Z",
          },
          indexedAt: "2024-12-01T12:00:00Z",
        },
      ],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockSessionResponse), { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
    );

    const result = await fetchBluesky(
      ["#vibecoding"],
      "test.bsky.social",
      "app-password-1234",
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].author).toBe("Dev");
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
