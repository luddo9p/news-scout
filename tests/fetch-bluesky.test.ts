import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBluesky } from "../src/fetch-bluesky.js";

vi.mock("../src/date-filter.js", () => ({
  getSinceTimestamp: () => ({
    iso: "2024-04-13T00:00:00.000Z",
    unix: 1712966400,
    date: "2024-04-13",
  }),
}));

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

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
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
    // Verify 24h date filter (since param) is applied
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("since=");
  });

  it("should authenticate and filter by followers when credentials provided", async () => {
    // Mock createSession
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          accessJwt: "test-jwt",
          did: "did:plc:me",
          handle: "test.bsky.social",
        }),
        { status: 200 },
      ),
    );

    // Mock searchPosts — 2 posts from different authors
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          posts: [
            {
              uri: "at://did:plc:big/app.bsky.feed.post/1",
              author: {
                handle: "big.bsky.social",
                displayName: "Big Account",
                did: "did:plc:big",
              },
              record: {
                text: "Popular post",
                createdAt: "2024-12-01T10:00:00Z",
              },
              indexedAt: "2024-12-01T10:00:00Z",
            },
            {
              uri: "at://did:plc:small/app.bsky.feed.post/2",
              author: {
                handle: "small.bsky.social",
                displayName: "Small Account",
                did: "did:plc:small",
              },
              record: { text: "Niche post", createdAt: "2024-12-01T11:00:00Z" },
              indexedAt: "2024-12-01T11:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    // Mock getProfiles — big account has 5000 followers, small has 100
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          profiles: [
            {
              did: "did:plc:big",
              handle: "big.bsky.social",
              followersCount: 5000,
            },
            {
              did: "did:plc:small",
              handle: "small.bsky.social",
              followersCount: 100,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchBluesky(
      ["#vibecoding"],
      "test.bsky.social",
      "app-pass",
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toContain("Popular post");
  });

  it("should return all posts when no credentials provided (no follower filter)", async () => {
    const mockSearchResponse = {
      posts: [
        {
          uri: "at://did:plc:abc/app.bsky.feed.post/1",
          author: { handle: "user.bsky.social", displayName: "User" },
          record: { text: "Post 1", createdAt: "2024-12-01T10:00:00Z" },
          indexedAt: "2024-12-01T10:00:00Z",
        },
        {
          uri: "at://did:plc:abc/app.bsky.feed.post/2",
          author: { handle: "user.bsky.social", displayName: "User" },
          record: { text: "Post 2", createdAt: "2024-12-01T11:00:00Z" },
          indexedAt: "2024-12-01T11:00:00Z",
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSearchResponse), { status: 200 }),
    );

    const result = await fetchBluesky(["#vibecoding"]);

    // No auth = no follower filter, so all posts are returned
    expect(result.items).toHaveLength(2);
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
