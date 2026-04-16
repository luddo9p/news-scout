import type { SourceResult, ContentItem } from "./shared/types.js";
import { getSinceTimestamp } from "./shared/date-filter.js";

const BSKY_PDS = "https://bsky.social";
const TIMEOUT_MS = 10000;
const SEARCH_LIMIT = 20;
const MIN_FOLLOWERS = 1000;

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

interface BlueskyProfileView {
  did: string;
  handle: string;
  displayName?: string;
  followersCount?: number;
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

async function getProfilesBatch(
  dids: string[],
  authHeader: Record<string, string>,
): Promise<Map<string, number>> {
  const followersMap = new Map<string, number>();

  // Batch max 25 DIDs per request
  for (let i = 0; i < dids.length; i += 25) {
    const batch = dids.slice(i, i + 25);
    const params = batch
      .map((did) => `actors=${encodeURIComponent(did)}`)
      .join("&");
    const url = `${BSKY_PDS}/xrpc/app.bsky.actor.getProfiles?${params}`;

    try {
      const response = await fetch(url, { headers: authHeader });
      if (!response.ok) continue;

      const data = await response.json();
      const profiles: BlueskyProfileView[] = data.profiles ?? [];
      for (const profile of profiles) {
        followersMap.set(profile.did, profile.followersCount ?? 0);
      }
    } catch {
      // Skip this batch on error
    }
  }

  return followersMap;
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

    // Search each hashtag separately and merge results
    const allPosts: BlueskyPost[] = [];
    const seenUris = new Set<string>();
    const { iso } = getSinceTimestamp();

    for (const tag of hashtags) {
      const url = `${BSKY_PDS}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(tag)}&limit=${SEARCH_LIMIT}&sort=top&since=${encodeURIComponent(iso)}`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: authHeader,
      });

      if (!response.ok) {
        // If one tag fails, continue with others
        continue;
      }

      const data: BlueskySearchResponse = await response.json();
      for (const post of data.posts ?? []) {
        if (!seenUris.has(post.uri)) {
          seenUris.add(post.uri);
          allPosts.push(post);
        }
      }
    }

    clearTimeout(timeout);

    let posts: BlueskyPost[] = allPosts;

    // Filter by follower count if authenticated
    if (authHeader.Authorization && posts.length > 0) {
      const uniqueDids = [...new Set(posts.map((p) => p.author.did))];
      const followersMap = await getProfilesBatch(uniqueDids, authHeader);

      posts = posts.filter((post) => {
        const followers = followersMap.get(post.author.did) ?? 0;
        return followers >= MIN_FOLLOWERS;
      });
    }

    const items: ContentItem[] = posts.map(postToContentItem);

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
