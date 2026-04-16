import type { SourceResult, ContentItem } from "./shared/types.js";
import { getSinceTimestamp } from "./shared/date-filter.js";

const HN_API = "https://hn.algolia.com/api/v1/search";
const TIMEOUT_MS = 5000;
const HITS_PER_PAGE = 10;

interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  points: number;
  num_comments: number;
  created_at: string;
}

interface HNSearchResponse {
  hits: HNHit[];
  nbHits: number;
}

function hitToContentItem(hit: HNHit): ContentItem | null {
  if (!hit.title) return null;
  return {
    title: hit.title,
    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    summary: hit.title,
    source: "Hacker News",
    author: hit.author || undefined,
    date: hit.created_at,
    score: hit.points,
  };
}

export async function fetchHackerNews(
  queries: string[],
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const allItems: ContentItem[] = [];
    const { unix } = getSinceTimestamp();

    for (const query of queries) {
      const url = `${HN_API}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${HITS_PER_PAGE}&numericFilters=created_at_i>${unix}`;
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        return {
          source: "Hacker News",
          items: allItems,
          error: `API returned ${response.status} for query "${query}"`,
        };
      }

      const data: HNSearchResponse = await response.json();
      const items = data.hits
        .map(hitToContentItem)
        .filter((item): item is ContentItem => item !== null);
      allItems.push(...items);
    }

    clearTimeout(timeout);

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    return { source: "Hacker News", items: unique };
  } catch (err) {
    clearTimeout(timeout);
    return {
      source: "Hacker News",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
