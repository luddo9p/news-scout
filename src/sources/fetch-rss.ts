import { XMLParser } from "fast-xml-parser";
import type { SourceResult, ContentItem } from "../shared/types.js";

const TIMEOUT_MS = 10000;
const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "item",
});

export interface RssFeedConfig {
  url: string;
  label: string;
}

function parseRssItems(xml: string): ContentItem[] {
  try {
    const parsed = parser.parse(xml);
    const channel = parsed?.rss?.channel || parsed?.feed;
    const rssItems: unknown[] = channel?.item || channel?.entry || [];

    return rssItems
      .map((entry: unknown): ContentItem | null => {
        if (typeof entry !== "object" || entry === null) return null;
        const e = entry as Record<string, unknown>;
        const title = String(e.title || "");
        const link =
          typeof e.link === "object"
            ? String((e.link as Record<string, string>)?.href || "")
            : String(e.link || "");
        const description = String(e.description || e.summary || "");
        const pubDate = String(e.pubDate || e.published || e.updated || "");

        if (!title || !link) return null;

        return {
          title,
          url: link,
          summary: description || title,
          source: "RSS",
          date: pubDate ? new Date(pubDate).toISOString() : undefined,
        };
      })
      .filter((item): item is ContentItem => item !== null);
  } catch {
    return [];
  }
}

async function fetchSingleFeed(config: RssFeedConfig): Promise<ContentItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(config.url, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const xml = await response.text();
    return parseRssItems(xml);
  } catch {
    return [];
  }
}

export async function fetchRss(feeds: RssFeedConfig[]): Promise<SourceResult> {
  try {
    const results = await Promise.all(feeds.map(fetchSingleFeed));

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];

    for (const items of results) {
      for (const item of items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    }

    const label = feeds[0]?.label || "RSS";

    return { source: label, items: allItems };
  } catch (err) {
    return {
      source: feeds[0]?.label || "RSS",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}