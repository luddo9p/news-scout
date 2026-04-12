import type { SourceResult, ContentItem } from "./types.js";

const BSKY_API = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const TIMEOUT_MS = 5000;
const LIMIT = 20;

interface BlueskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
}

interface BlueskyPost {
  uri: string;
  author: BlueskyAuthor;
  record: {
    text: string;
    createdAt: string;
    [key: string]: unknown;
  };
  indexedAt: string;
}

interface BlueskySearchResponse {
  posts: BlueskyPost[];
  cursor?: string;
}

function extractPostId(uri: string): string {
  const parts = uri.split("/");
  return parts[parts.length - 1];
}

function postToContentItem(post: BlueskyPost): ContentItem {
  const postId = extractPostId(post.uri);
  return {
    title:
      post.record.text.slice(0, 120) +
      (post.record.text.length > 120 ? "..." : ""),
    url: `https://bsky.app/profile/${post.author.handle}/post/${postId}`,
    summary: post.record.text,
    source: "Bluesky",
    author: post.author.displayName || post.author.handle,
    date: post.record.createdAt,
  };
}

export async function fetchBluesky(hashtags: string[]): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const query = hashtags.join(" ");
    const url = `${BSKY_API}?q=${encodeURIComponent(query)}&limit=${LIMIT}`;

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source: "Bluesky",
        items: [],
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    const data: BlueskySearchResponse = await response.json();
    const items: ContentItem[] = (data.posts ?? []).map(postToContentItem);

    return { source: "Bluesky", items };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: "Bluesky",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
