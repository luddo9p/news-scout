const HOURS_24_MS = 24 * 60 * 60 * 1000;

export function getSinceTimestamp(): {
  /** ISO 8601 string — Bluesky `since` param */
  iso: string;
  /** Unix epoch seconds — HN Algolia `numericFilters` */
  unix: number;
  /** YYYY-MM-DD string — Apify Twitter `start` param */
  date: string;
} {
  const since = new Date(Date.now() - HOURS_24_MS);
  return {
    iso: since.toISOString(),
    unix: Math.floor(since.getTime() / 1000),
    date: since.toISOString().slice(0, 10),
  };
}