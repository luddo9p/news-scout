import * as cheerio from "cheerio";
import type { ContentItem, SourceResult } from "../shared/types.js";

const TIMEOUT_MS = 12000;
/** Each search costs a request: five operations per run is plenty for a weekly digest. */
const MAX_SEARCHES = 5;
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";
const DUCKDUCKGO_URL = "https://html.duckduckgo.com/html/";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/**
 * Markers of a real digital operation. Bare "VR" is deliberately absent: it matches
 * every hardware headline from a VR news outlet, and the heuristic would then happily
 * attach meta.com as an "experience". `try-on`, `AR`, `immersive` and `experiential`
 * are the words luxury houses actually use for their activations.
 */
const OP_KEYWORDS =
  /immersi|experiential|microsite|interactive|metaverse|webgl|try-?on|augmented|\bAR\b|\b3D\b|experience|expérience|virtuel/i;

/** A search result from one of these is never the brand's own site. */
const NON_BRAND_HOSTS =
  /(duckduckgo|facebook|twitter|x\.com|instagram|linkedin|youtube|vimeo|pinterest|tiktok|wikipedia|reddit|medium|substack|prnewswire|businesswire|globenewswire|wordpress|blogspot|amazon|ebay|scribd|issuu|yelp|glassdoor|trustpilot|luxurydaily|vogue|hypebeast|wwd|jingdaily|ladn|influencia|creativereview|thedieline|marketingweek|fashionnetwork|journalduluxe|lemonde|lesechos)/i;

/** Words that never identify a brand, in both languages of the feeds. */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "its", "his", "her", "will",
  "new", "into", "over", "after", "before", "your", "their", "about", "more",
  "une", "des", "les", "dans", "pour", "avec", "sur", "aux", "par", "plus", "son",
  "ses", "est", "sont", "mais", "comme", "chez", "entre", "vers", "leur", "leurs",
  "cette", "ces", "qui", "que", "quoi", "dont", "devoile", "lance", "ouvre",
  "unveils", "launches", "brings", "heads", "opens", "swaps", "takes", "makes",
  "joins", "announces", "introduces", "reveals", "showcase", "collection",
  // Operation words: an agency called "immersive-something" must never be mistaken
  // for the brand just because the article uses the word.
  "immersive", "experience", "experiential", "digital", "interactive", "virtual",
  "reality", "metaverse", "flagship", "microsite", "augmented", "mobile",
  "application", "website", "online",
]);

export interface SearchHit {
  url: string;
}

export function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Significant words of a title, used to check a result really is the brand's site. */
export function tokensOf(title: string): string[] {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

/**
 * Only articles describing a digital or immersive operation are worth a search.
 * The title alone is tested on purpose: descriptions are long and drag in unrelated
 * stories (a beauty round-up mentioning "digital" is not an operation), and the
 * search budget is only five requests per run.
 */
export function looksLikeOperation(item: ContentItem): boolean {
  return OP_KEYWORDS.test(item.title);
}

/**
 * Picks the result that looks like the brand's own site: its host has to start with
 * one of the title's significant words (score 2) or at least contain one (score 1).
 * Anything else is ignored — a wrong link is worse than no link in a veille.
 */
export function pickBrandResult(
  results: SearchHit[],
  tokens: string[],
): string | undefined {
  const needles = tokens
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 4);
  if (needles.length === 0) return undefined;

  let best: { url: string; score: number } | undefined;
  for (const result of results) {
    const host = hostOf(result.url);
    if (!host || NON_BRAND_HOSTS.test(host)) continue;
    const flat = host.replace(/[^a-z0-9]/g, "");

    let score = 0;
    for (const needle of needles) {
      if (flat.startsWith(needle)) score = 2;
      else if (score < 1 && flat.includes(needle)) score = 1;
      if (score === 2) break;
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { url: result.url, score };
      if (score === 2) break;
    }
  }

  return best?.url;
}

async function braveSearch(query: string, apiKey: string): Promise<SearchHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(
      `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=10`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Brave returned HTTP ${response.status}`);
    }
    const data = await response.json();
    const results: { url?: string }[] = data?.web?.results ?? [];
    return results
      .filter((result): result is { url: string } => typeof result.url === "string")
      .map((result) => ({ url: result.url }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Keyless fallback. DuckDuckGo challenges after a few requests, hence the Brave path. */
async function duckduckgoSearch(query: string): Promise<SearchHit[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(DUCKDUCKGO_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!response.ok) {
      throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const anchors = $("a.result__a").toArray();
    const hrefs =
      anchors.length > 0
        ? anchors.map((anchor) => $(anchor).attr("href") ?? "")
        : [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);

    return hrefs
      .map((href) => {
        const encoded = href.match(/uddg=([^&]+)/);
        return { url: encoded ? decodeURIComponent(encoded[1]) : href };
      })
      .filter((hit) => /^https?:\/\//i.test(hit.url) && !hostOf(hit.url).includes("duckduckgo"));
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBrandSite(item: ContentItem): Promise<string | undefined> {
  const tokens = tokensOf(item.title);
  if (tokens.length === 0) return undefined;

  const query = `${item.title.slice(0, 120)} immersive experience site`;
  const braveKey = process.env.BRAVE_API_KEY;

  try {
    const results = braveKey
      ? await braveSearch(query, braveKey)
      : await duckduckgoSearch(query);
    return pickBrandResult(results, tokens);
  } catch (err) {
    console.warn(
      `[resolve-experience] search failed for "${item.title.slice(0, 40)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

/**
 * Looks for the brand site or microsite behind each digital operation reported by the
 * news feeds, and attaches it as `experienceUrl`. The press never links to the
 * experience itself, so a web search is the only way to get there.
 *
 * This is an enrichment, not a source: it never throws, and a failure simply leaves
 * the items untouched.
 */
export async function resolveExperienceUrls(
  sources: SourceResult[],
): Promise<SourceResult[]> {
  const candidates: ContentItem[] = sources
    .filter((source) => !source.error)
    .flatMap((source) => source.items)
    .filter(looksLikeOperation)
    .slice(0, MAX_SEARCHES);

  if (candidates.length === 0) return sources;

  const found = new Map<string, string>();
  for (const item of candidates) {
    const url = await searchBrandSite(item);
    if (url) found.set(item.url, url);
  }

  const provider = process.env.BRAVE_API_KEY ? "Brave" : "DuckDuckGo";
  if (found.size === 0) {
    console.warn(
      `[resolve-experience] ${provider}: no brand site found for ${candidates.length} candidate(s)`,
    );
    return sources;
  }

  console.log(
    `[resolve-experience] ${provider}: ${found.size}/${candidates.length} experience URL(s) resolved`,
  );

  return sources.map((source) => ({
    ...source,
    items: source.items.map((item) => {
      const experienceUrl = found.get(item.url);
      return experienceUrl ? { ...item, experienceUrl } : item;
    }),
  }));
}
