import { XMLParser } from "fast-xml-parser";
import type { SourceResult, ContentItem } from "../shared/types.js";

const TIMEOUT_MS = 10000;
const HOURS_MS = 60 * 60 * 1000;
/** The tech agent runs twice a day and wants the last 24 h. */
const DEFAULT_MAX_AGE_HOURS = 24;
const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "item" || name === "entry",
  // Rich feeds (simonwillison.net) exceed the default 1000 entity expansions and
  // would fail to parse entirely. maxExpandedLength still bounds the output, so
  // this stays safe against entity-expansion abuse.
  processEntities: { enabled: true, maxTotalExpansions: 10000 },
});

export interface RssFeedConfig {
  url: string;
  label: string;
}

/** Outcome of a single feed: items when it worked, a reason when it did not. */
interface FeedResult {
  items: ContentItem[];
  error?: string;
}

/** Returns undefined instead of throwing when a feed carries an unparseable date. */
function toIsoDate(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * fast-xml-parser returns an object as soon as a tag carries an attribute, so
 * `<title type="html">Hello</title>` becomes `{ "#text": "Hello", "@_type": "html" }`.
 * Stringifying it directly yields "[object Object]": the text has to be dug out.
 */
function textOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return textOf(value[0]);
  if (typeof value === "object") {
    return textOf((value as Record<string, unknown>)["#text"]);
  }
  return "";
}

/**
 * RSS 2.0 carries the URL in the tag body (`<link>url</link>`), Atom carries it in
 * an attribute (`<link rel="alternate" href="url"/>`), often as an array of links.
 * Reading only `link.href` silently dropped every Atom entry.
 */
function linkOf(value: unknown): string {
  if (Array.isArray(value)) {
    const alternate = value.find((entry) => {
      if (entry === null || typeof entry !== "object") return false;
      const rel = (entry as Record<string, unknown>)["@_rel"];
      return rel === undefined || rel === "alternate";
    });
    return linkOf(alternate ?? value[0]);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textOf(record["@_href"] ?? record.href ?? record["#text"]);
  }
  return textOf(value);
}

/** Some Atom feeds only expose a `tag:` id, which is not a usable URL. */
function httpUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : "";
}

function parseRssItems(
  xml: string,
  cutoffMs: number,
  feedLabel: string,
): FeedResult {
  try {
    const parsed = parser.parse(xml);
    const rssRoot = parsed?.rss;
    const atomRoot = parsed?.feed;
    // The XML parser is lenient: an HTML error page parses into an object with no
    // feed root at all. Without this check it would look like an empty feed.
    if (!rssRoot && !atomRoot) {
      return { items: [], error: "unrecognized feed format" };
    }
    const channel = rssRoot?.channel || atomRoot;
    const rssItems: unknown[] = channel?.item || channel?.entry || [];

    const items = rssItems
      .map((entry: unknown): ContentItem | null => {
        if (typeof entry !== "object" || entry === null) return null;
        const e = entry as Record<string, unknown>;
        const title = textOf(e.title);
        const link = linkOf(e.link) || httpUrl(textOf(e.id));
        const description = textOf(e.description ?? e.summary);
        const pubDate = textOf(e.pubDate ?? e.published ?? e.updated);

        if (!title || !link) return null;

        return {
          title,
          url: link,
          context: description || title,
          // The feed label rather than "RSS": the model must be able to name the outlet.
          source: feedLabel,
          date: toIsoDate(pubDate),
        };
      })
      .filter((item): item is ContentItem => item !== null)
      // Undated items are kept: they cannot be judged, and editorial feeds are small.
      .filter(
        (item) => item.date === undefined || Date.parse(item.date) >= cutoffMs,
      );

    return { items };
  } catch (err) {
    return {
      items: [],
      error: `parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function fetchSingleFeed(
  config: RssFeedConfig,
  cutoffMs: number,
): Promise<FeedResult> {
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

    if (!response.ok) return { items: [], error: `HTTP ${response.status}` };

    const xml = await response.text();
    return parseRssItems(xml, cutoffMs, config.label);
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * `maxAgeHours` is per agent: the tech agent runs twice a day and wants 24 h, the
 * weekly luxury agent needs a wider window or it would only ever see one day.
 */
export async function fetchRss(
  feeds: RssFeedConfig[],
  maxAgeHours: number = DEFAULT_MAX_AGE_HOURS,
): Promise<SourceResult> {
  const cutoffMs = Date.now() - maxAgeHours * HOURS_MS;

  try {
    const results = await Promise.all(
      feeds.map((feed) => fetchSingleFeed(feed, cutoffMs)),
    );

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];
    const warnings: string[] = [];

    results.forEach((result, index) => {
      const feed = feeds[index];
      if (result.error) {
        warnings.push(`${feed.label} (${feed.url}): ${result.error}`);
      }
      for (const item of result.items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    });

    // One label means one outlet; several labels mean a merged feed, and naming it
    // after the first one would credit every item to the wrong outlet in the logs.
    const distinctLabels = new Set(feeds.map((feed) => feed.label));
    const label =
      feeds.length === 0
        ? "RSS"
        : distinctLabels.size === 1
          ? feeds[0].label
          : `${feeds.length} feeds`;

    // Every feed down is a source failure, not an empty source.
    if (feeds.length > 0 && warnings.length === feeds.length) {
      return { source: label, items: allItems, error: warnings.join(" ; ") };
    }

    const sourceResult: SourceResult = { source: label, items: allItems };
    if (warnings.length > 0) sourceResult.warnings = warnings;

    return sourceResult;
  } catch (err) {
    return {
      source: feeds[0]?.label || "RSS",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
