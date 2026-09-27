import type { SourceResult, ContentItem } from "../shared/types.js";

const REDDIT_BASE = "https://www.reddit.com";
const REDDIT_OAUTH_BASE = "https://oauth.reddit.com";
const REDDIT_TOKEN_URL = `${REDDIT_BASE}/api/v1/access_token`;
const DEFAULT_USER_AGENT = "AgentScout/1.0 (veille bot)";
// Renew the token 60s before Reddit expires it, so a request never races the deadline.
const TOKEN_EXPIRY_MARGIN_MS = 60000;
const TIMEOUT_MS = 10000;
const POSTS_PER_SUBREDDIT = 10;

interface RedditPostData {
  id: string;
  title: string;
  url: string;
  selftext: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  permalink: string;
}

interface RedditSearchResponse {
  data: {
    children: Array<{ data: RedditPostData }>;
  };
}

interface RedditTokenResponse {
  access_token?: string;
  expires_in?: number;
}

/** Module-level token cache: one token per process, shared by every subreddit search. */
let cachedToken: { value: string; expiresAt: number } | null = null;

function redditPostToContentItem(post: RedditPostData): ContentItem {
  const postUrl = post.url.startsWith("/r/")
    ? `https://www.reddit.com${post.permalink}`
    : post.url;

  const context = post.selftext
    ? post.selftext.slice(0, 200) + (post.selftext.length > 200 ? "..." : "")
    : post.title;

  return {
    title: post.title,
    url: postUrl,
    context,
    source: "Reddit",
    author: post.author,
    date: new Date(post.created_utc * 1000).toISOString(),
    score: post.score,
  };
}

/**
 * Fetch an OAuth2 token with the client_credentials flow, reusing the cached one
 * while it is still valid. Returns an explicit error instead of throwing so the
 * caller can surface a source-level failure.
 */
async function getAccessToken(): Promise<{ token: string } | { error: string }> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return {
      error:
        "Reddit OAuth credentials missing: set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (Reddit app of type script).",
    };
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { token: cachedToken.value };
  }

  const userAgent = process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(REDDIT_TOKEN_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent,
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        error: `Reddit OAuth token request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }

    const data: RedditTokenResponse = await response.json();
    if (!data.access_token) {
      return { error: "Reddit OAuth token response contained no access_token" };
    }

    const expiresInMs = (data.expires_in ?? 3600) * 1000;
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(expiresInMs - TOKEN_EXPIRY_MARGIN_MS, 0),
    };

    return { token: data.access_token };
  } catch (err) {
    return {
      error: `Reddit OAuth token request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Outcome of a single subreddit search: items when it worked, a reason when it did not. */
interface SubredditResult {
  items: ContentItem[];
  error?: string;
}

async function fetchSubreddit(
  subreddit: string,
  keywords: string[],
  timeRange: string,
  accessToken: string,
): Promise<SubredditResult> {
  const query = keywords.map((k) => `"${k}"`).join(" OR ");
  const url = `${REDDIT_OAUTH_BASE}/r/${subreddit}/search?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&t=${timeRange}&limit=${POSTS_PER_SUBREDDIT}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": process.env.REDDIT_USER_AGENT || DEFAULT_USER_AGENT,
        Accept: "application/json",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return { items: [], error: `HTTP ${response.status}` };

    const data: RedditSearchResponse = await response.json();
    return {
      items: (data.data?.children ?? []).map((c) =>
        redditPostToContentItem(c.data),
      ),
    };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchReddit(
  subreddits: string[],
  keywords: string[],
  timeRange: string = "day",
): Promise<SourceResult> {
  try {
    // One token for the whole run: a token failure is a source failure, not a
    // per-subreddit warning, because every search would fail the same way.
    const auth = await getAccessToken();
    if ("error" in auth) {
      return { source: "Reddit", items: [], error: auth.error };
    }

    // Fetch all subreddits in parallel
    const results = await Promise.all(
      subreddits.map((sub) =>
        fetchSubreddit(sub, keywords, timeRange, auth.token),
      ),
    );

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];
    const warnings: string[] = [];

    results.forEach((result, index) => {
      if (result.error) {
        warnings.push(`${subreddits[index]}: ${result.error}`);
      }
      for (const item of result.items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    });

    // Sort by score descending
    allItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    // Every subreddit down is a source failure, not an empty source.
    if (subreddits.length > 0 && warnings.length === subreddits.length) {
      return {
        source: "Reddit",
        items: allItems,
        error: `All ${subreddits.length} subreddits failed: ${warnings.join(" ; ")}`,
      };
    }

    const sourceResult: SourceResult = { source: "Reddit", items: allItems };
    if (warnings.length > 0) sourceResult.warnings = warnings;

    return sourceResult;
  } catch (err) {
    return {
      source: "Reddit",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
