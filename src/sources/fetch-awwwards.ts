import * as cheerio from "cheerio";
import type { SourceResult, ContentItem } from "../shared/types.js";

const TIMEOUT_MS = 15000;
const AWWWARDS_BASE = "https://www.awwwards.com";
/** Curated categories where luxury brands actually publish immersive experiences. */
const CATEGORIES = ["luxury", "fashion", "jewelry", "beauty"];
const HOURS_MS = 60 * 60 * 1000;
/** The weekly luxury agent needs a whole week, not a day. */
const DEFAULT_MAX_AGE_HOURS = 24 * 7;
const MAX_PER_CATEGORY = 8;
/**
 * Awarded sites carry a date, but sites still open for voting (`VOTE NOW`) do not.
 * They are the freshest ones, so a few are kept — they will get a date and drop out
 * of the window once awarded.
 */
const MAX_NOMINEES_PER_CATEGORY = 3;
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const AWARDS = [
  "Site Of The Day",
  "Site Of The Month",
  "Honorable Mention",
  "Developer Award",
];
const DATE_WITH_DAY = /([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/;
const DATE_MONTH_ONLY = /([A-Z][a-z]{2}), (\d{4})/;

/** Outcome of a single category page: items when it worked, a reason when it did not. */
interface CategoryResult {
  items: ContentItem[];
  error?: string;
}

/** Awwwards' outbound links sometimes carry tracking params, which look bad in an email. */
function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["srsltid", "fbclid", "gclid"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

/** Awwwards prints full dates ("Sep 27, 2026") and month-only ones ("Aug, 2026"). */
function parseCardDate(text: string): string | undefined {
  const withDay = text.match(DATE_WITH_DAY);
  if (withDay) {
    const parsed = new Date(`${withDay[1]} ${withDay[2]}, ${withDay[3]}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  const monthOnly = text.match(DATE_MONTH_ONLY);
  if (monthOnly) {
    const parsed = new Date(`${monthOnly[1]} 1, ${monthOnly[2]}`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  return undefined;
}

/**
 * One card holds the awarded project and the live URL of the experience itself —
 * which is the whole point here: press articles link to an article, Awwwards links
 * to the site you can actually visit. The studio behind the site is deliberately
 * left out: agencies are often bound by the brand's confidentiality, and the veille
 * is about the brands, not about who built their site.
 */
export function parseCategoryHtml(
  html: string,
  category: string,
  cutoffMs: number,
): ContentItem[] {
  const $ = cheerio.load(html);
  const items: ContentItem[] = [];
  let nominees = 0;

  for (const anchor of $("a.figure-rollover__bt").toArray()) {
    if (items.length >= MAX_PER_CATEGORY) break;

    const url = cleanUrl($(anchor).attr("href") ?? "");
    if (!/^https?:\/\//i.test(url)) continue;

    const card = $(anchor).closest(".card-site");
    const title = card.find("a.figure-rollover__link").attr("aria-label")?.trim() ?? "";
    if (!title) continue;

    const text = card.text().replace(/\s+/g, " ").trim();
    const date = parseCardDate(text);

    if (date === undefined) {
      // Undated cards are the ones still open for voting.
      if (!text.includes("VOTE NOW")) continue;
      if (nominees >= MAX_NOMINEES_PER_CATEGORY) continue;
      nominees++;
    } else if (Date.parse(date) < cutoffMs) {
      continue;
    }

    const award = AWARDS.find((candidate) => text.includes(candidate)) ?? "Awwwards";
    const context = `Expérience web immersive (${award.toLowerCase()}, ${category}).`;

    items.push({
      title,
      url,
      context,
      source: "Awwwards",
      date,
      tags: [category, award],
    });
  }

  return items;
}

async function fetchCategory(
  category: string,
  cutoffMs: number,
): Promise<CategoryResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${AWWWARDS_BASE}/websites/${category}/`, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return { items: [], error: `HTTP ${response.status}` };

    const html = await response.text();
    return { items: parseCategoryHtml(html, category, cutoffMs) };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Reads the Awwwards award galleries and returns the live URL of each experience.
 * `maxAgeHours` matches the caller's cadence, like `fetchRss`.
 */
export async function fetchAwwwards(
  maxAgeHours: number = DEFAULT_MAX_AGE_HOURS,
): Promise<SourceResult> {
  const cutoffMs = Date.now() - maxAgeHours * HOURS_MS;

  try {
    const results = await Promise.all(
      CATEGORIES.map((category) => fetchCategory(category, cutoffMs)),
    );

    const seen = new Set<string>();
    const allItems: ContentItem[] = [];
    const warnings: string[] = [];

    results.forEach((result, index) => {
      const category = CATEGORIES[index];
      if (result.error) {
        warnings.push(`${category}: ${result.error}`);
      }
      for (const item of result.items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        allItems.push(item);
      }
    });

    // Every category down is a source failure, not an empty source.
    if (warnings.length === CATEGORIES.length) {
      return { source: "Awwwards", items: allItems, error: warnings.join(" ; ") };
    }

    const sourceResult: SourceResult = { source: "Awwwards", items: allItems };
    if (warnings.length > 0) sourceResult.warnings = warnings;

    return sourceResult;
  } catch (err) {
    return {
      source: "Awwwards",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
