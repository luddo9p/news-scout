import type { SourceResult, ContentItem } from "../shared/types.js";
import { getSinceTimestamp } from "../shared/date-filter.js";

const DEVTO_API = "https://dev.to/api";
const TIMEOUT_MS = 10000;
const PER_PAGE = 20;

interface DevToArticle {
  id: number;
  title: string;
  url: string;
  description?: string;
  user?: {
    username?: string;
    name?: string;
  };
  positive_reactions_count?: number;
  published_at?: string;
  tags?: string[];
}

function articleToContentItem(article: DevToArticle): ContentItem | null {
  if (!article.title || !article.url) return null;

  return {
    title: article.title,
    url: article.url,
    context: article.description || article.title,
    source: "Dev.to",
    author: article.user?.username || article.user?.name || undefined,
    date: article.published_at,
    score: article.positive_reactions_count,
    tags: article.tags,
  };
}

export async function fetchDevTo(tags: string[]): Promise<SourceResult> {
  try {
    const { iso } = getSinceTimestamp();
    const tag = tags[0];
    if (!tag) return { source: "Dev.to", items: [] };
    const url = `${DEVTO_API}/articles?per_page=${PER_PAGE}&tag=${encodeURIComponent(tag)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source: "Dev.to",
        items: [],
        error: `Dev.to API returned ${response.status}`,
      };
    }

    const data: DevToArticle[] = await response.json();

    const seen = new Set<string>();
    const items: ContentItem[] = data
      .map(articleToContentItem)
      .filter((item): item is ContentItem => item !== null && item.url !== "")
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        if (!item.date) return true;
        return new Date(item.date) >= new Date(iso);
      });

    return { source: "Dev.to", items };
  } catch (err) {
    return {
      source: "Dev.to",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}