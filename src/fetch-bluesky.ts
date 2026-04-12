import type { SourceResult, ContentItem } from "./types.js";

const BSKY_PDS = "https://bsky.social";
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

interface SessionResponse {
  accessJwt: string;
  did: string;
  handle: string;
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

async function createSession(
  handle: string,
  appPassword: string,
): Promise<string> {
  const response = await fetch(
    `${BSKY_PDS}/xrpc/com.atproto.server.createSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: handle,
        password: appPassword,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bluesky auth failed (${response.status}): ${body}`);
  }

  const data: SessionResponse = await response.json();
  return data.accessJwt;
}

export async function fetchBluesky(
  hashtags: string[],
  handle?: string,
  appPassword?: string,
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Authenticate if credentials are provided
    let authHeader: Record<string, string> = {};
    if (handle && appPassword) {
      const accessJwt = await createSession(handle, appPassword);
      authHeader = { Authorization: `Bearer ${accessJwt}` };
    }

    const query = hashtags.join(" ");
    const url = `${BSKY_PDS}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${LIMIT}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: authHeader,
    });
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
