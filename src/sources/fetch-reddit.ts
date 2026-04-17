import type { SourceResult, ContentItem } from "../shared/types.js";

const REDDIT_BASE = "https://www.reddit.com";
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

function redditPostToContentItem(post: RedditPostData): ContentItem {
  const postUrl = post.url.startsWith("/r/")
    ? `https://www.reddit.com${post.permalink}`
    : post.url;

  const summary = post.selftext
    ? post.selftext.slice(0, 200) + (post.selftext.length > 200 ? "..." : "")
    : post.title;

  return {
    title: post.title,
    url: postUrl,
    summary,
    source: "Reddit",
    author: post.author,
    date: new Date(post.created_utc * 1000).toISOString(),
    score: post.score,
  };
}

async function fetchSubreddit(
  subreddit: string,
  keywords: string[],
  timeRange: string,
): Promise<ContentItem[]> {
  const query = keywords.map((k) => `"${k}"`).join(" OR ");
  const url = `${REDDIT_BASE}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=relevance&t=${timeRange}&limit=${POSTS_PER_SUBREDDIT}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AgentScout/1.0 (tech-watch bot)",
        Accept: "application/json",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const data: RedditSearchResponse = await response.json();
    return (data.data?.children ?? []).map((c) =>
      redditPostToContentItem(c.data),
    );
  } catch {
    return [];
  }
}

export async function fetchReddit(
  subreddits: string[],
  keywords: string[],
  timeRange: string = "day",
): Promise<SourceResult> {
  try {
    // Fetch all subreddits in parallel
    const results = await Promise.all(
      subreddits.map((sub) => fetchSubreddit(sub, keywords, timeRange)),
    );

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];

    for (const items of results) {
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    }

    // Sort by score descending
    allItems.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return { source: "Reddit", items: allItems };
  } catch (err) {
    return {
      source: "Reddit",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}