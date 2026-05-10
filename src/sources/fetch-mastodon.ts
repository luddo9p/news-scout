import type { SourceResult, ContentItem } from "../shared/types.js";
import { getSinceTimestamp } from "../shared/date-filter.js";

const MASTODON_INSTANCE = "https://mastodon.social";
const TIMEOUT_MS = 10000;
const MAX_RESULTS = 20;

interface MastodonStatus {
  uri: string;
  url?: string;
  content?: string;
  account?: {
    username?: string;
    display_name?: string;
  };
  favourites_count?: number;
  created_at?: string;
  tags?: { name: string }[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function statusToContentItem(status: MastodonStatus): ContentItem | null {
  const text = status.content ? stripHtml(status.content) : "";
  if (!text) return null;

  const title = text.length > 120 ? text.slice(0, 120) + "..." : text;

  return {
    title,
    url: status.url || status.uri,
    context: text,
    source: "Mastodon",
    author: status.account?.username || status.account?.display_name || undefined,
    date: status.created_at,
    score: status.favourites_count,
    tags: status.tags?.map((t) => `#${t.name}`),
  };
}

export async function fetchMastodon(
  hashtags: string[],
): Promise<SourceResult> {
  try {
    const { iso } = getSinceTimestamp();
    const query = hashtags.map((t) => t.replace(/^#/, "")).join(" OR ");
    const url = `${MASTODON_INSTANCE}/api/v2/search?q=${encodeURIComponent(query)}&type=statuses&limit=${MAX_RESULTS}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source: "Mastodon",
        items: [],
        error: `Mastodon API returned ${response.status}`,
      };
    }

    const data = await response.json();
    const statuses: MastodonStatus[] = data.statuses || [];

    const seen = new Set<string>();
    const items: ContentItem[] = statuses
      .map(statusToContentItem)
      .filter((item): item is ContentItem => item !== null && item.url !== "")
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        if (!item.date) return true;
        return new Date(item.date) >= new Date(iso);
      });

    return { source: "Mastodon", items };
  } catch (err) {
    return {
      source: "Mastodon",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}