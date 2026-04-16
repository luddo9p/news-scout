import type { SourceResult, ContentItem } from "../shared/types.js";
import { getSinceTimestamp } from "../shared/date-filter.js";

const APIFY_API_URL =
  "https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items";
const TIMEOUT_MS = 15000;
const MAX_ITEMS = 10;

interface ApifyTweetAuthor {
  userName?: string;
  name?: string;
}

interface ApifyTweet {
  url?: string;
  text?: string;
  author?: ApifyTweetAuthor;
  likeCount?: number;
  createdAt?: string;
}

const TWITTER_DATE_RE =
  /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{2}:\d{2}:\d{2}) \+(\d{4}) (\d{4})$/;

function parseTwitterDate(dateStr: string): string {
  const match = dateStr.match(TWITTER_DATE_RE);
  if (!match) return dateStr;
  return new Date(dateStr).toISOString();
}

function tweetToContentItem(tweet: ApifyTweet): ContentItem | null {
  if (!tweet.text) return null;

  const title =
    tweet.text.length > 120 ? tweet.text.slice(0, 120) + "..." : tweet.text;

  return {
    title,
    url: tweet.url || "",
    summary: tweet.text,
    source: "X/Twitter",
    author: tweet.author?.userName || tweet.author?.name || undefined,
    date: tweet.createdAt ? parseTwitterDate(tweet.createdAt) : undefined,
    score: tweet.likeCount,
  };
}

export async function fetchTwitter(
  searchTerms: string[],
  apiKey: string,
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${APIFY_API_URL}?token=${encodeURIComponent(apiKey)}&clean=true`;
    const { iso } = getSinceTimestamp();

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        searchTerms,
        maxItems: MAX_ITEMS,
        sort: "Top",
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let errorMsg = `Apify API returned ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody?.error?.message) {
          errorMsg = errBody.error.message;
        }
      } catch {
        // ignore JSON parse errors on error responses
      }
      return {
        source: "X/Twitter",
        items: [],
        error: errorMsg,
      };
    }

    const data: ApifyTweet[] = await response.json();

    const items: ContentItem[] = data
      .map(tweetToContentItem)
      .filter((item): item is ContentItem => item !== null && item.url !== "")
      .filter((item) => {
        if (!item.date) return true;
        return new Date(item.date) >= new Date(iso);
      });

    return { source: "X/Twitter", items };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: "X/Twitter",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}