import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAwwwards, parseCategoryHtml } from "../../src/sources/fetch-awwwards.js";

const CATEGORY_URL = /awwwards\.com\/websites\/([a-z]+)\//;

/** Mirrors the real card markup: aria-label on the link, h3 for the studio. */
function card(options: {
  project: string;
  studio: string;
  live: string;
  vote?: boolean;
  date?: string;
  award?: string;
}): string {
  return `<div class="card-site">
    <a class="figure-rollover__link" aria-label="${options.project}" href="/sites/x">
      <img alt="${options.project}">
    </a>
    <div class="figure-rollover__row"><small> WEBSITE </small></div>
    <div class="figure-rollover__row">${options.project}</div>
    <h3>${options.studio}</h3>
    ${options.vote ? "<span>VOTE NOW</span>" : ""}
    ${options.date ? `<span>${options.award ?? "SOTD Site Of The Day"} ${options.date}</span>` : ""}
    <a class="figure-rollover__bt" href="${options.live}" target="_blank">visit</a>
  </div>`;
}

const page = (...cards: string[]): string => `<html><body>${cards.join("")}</body></html>`;

/** Awwwards prints "Sep 27, 2026", which is what the parser reads back. */
const awwwardsDate = (hoursAgo: number): string =>
  new Date(Date.now() - hoursAgo * 3600_000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function mockPages(pages: Record<string, string>): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const category = url.match(CATEGORY_URL)?.[1] ?? "";
    const html = pages[category];
    if (html === undefined) return new Response("Not found", { status: 404 });
    return new Response(html, { status: 200 });
  });
}

describe("parseCategoryHtml", () => {
  it("should expose the live experience URL, not the Awwwards page", () => {
    const html = page(
      card({
        project: "Velaa Private Island",
        studio: "STRV",
        live: "https://www.velaaprivateisland.com/",
        date: awwwardsDate(48),
      }),
    );

    const items = parseCategoryHtml(html, "luxury", Date.now() - 24 * 7 * 3600_000);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Velaa Private Island",
      url: "https://www.velaaprivateisland.com/",
      source: "Awwwards",
    });
    // The card names the studio, but it must never reach the veille: agencies are
    // often bound by the brand's confidentiality.
    expect(JSON.stringify(items[0])).not.toContain("STRV");
    expect(items[0].tags).toContain("luxury");
    expect(items[0].context).toContain("site of the day");
  });

  it("should drop awarded sites older than the window", () => {
    const html = page(
      card({ project: "Old", studio: "Studio", live: "https://old.com", date: awwwardsDate(24 * 20) }),
      card({ project: "Fresh", studio: "Studio", live: "https://fresh.com", date: awwwardsDate(24 * 2) }),
    );

    const items = parseCategoryHtml(html, "luxury", Date.now() - 24 * 7 * 3600_000);

    expect(items.map((i) => i.title)).toEqual(["Fresh"]);
  });

  it("should keep a few undated nominees and cap them", () => {
    const html = page(
      ...Array.from({ length: 6 }, (_, i) =>
        card({ project: `Nominee ${i}`, studio: "Studio", live: `https://n${i}.com`, vote: true }),
      ),
    );

    const items = parseCategoryHtml(html, "beauty", Date.now() - 24 * 7 * 3600_000);

    expect(items).toHaveLength(3);
    expect(items[0].date).toBeUndefined();
    expect(items[0].context).toContain("beauty");
  });

  it("should ignore undated cards that are not open for voting", () => {
    const html = page(card({ project: "No date", studio: "Studio", live: "https://nd.com" }));

    expect(parseCategoryHtml(html, "fashion", Date.now())).toHaveLength(0);
  });

  it("should ignore cards without a usable live URL", () => {
    const html = page(
      card({ project: "Relative", studio: "Studio", live: "/sites/relative", date: awwwardsDate(24) }),
    );

    expect(parseCategoryHtml(html, "fashion", Date.now() - 24 * 7 * 3600_000)).toHaveLength(0);
  });
});

describe("fetchAwwwards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should merge every category and deduplicate by URL", async () => {
    mockPages({
      luxury: page(
        card({ project: "Shared", studio: "Studio", live: "https://shared.com", date: awwwardsDate(24) }),
      ),
      fashion: page(
        card({ project: "Shared", studio: "Studio", live: "https://shared.com", date: awwwardsDate(24) }),
        card({ project: "Only fashion", studio: "Studio", live: "https://fashion.com", date: awwwardsDate(24) }),
      ),
      jewelry: page(
        card({ project: "Jewel", studio: "Studio", live: "https://jewel.com", date: awwwardsDate(24) }),
      ),
      beauty: page(
        card({ project: "Beauty", studio: "Studio", live: "https://beauty.com", date: awwwardsDate(24) }),
      ),
    });

    const result = await fetchAwwwards(24 * 7);

    expect(result.source).toBe("Awwwards");
    expect(result.items.map((i) => i.title)).toEqual([
      "Shared",
      "Only fashion",
      "Jewel",
      "Beauty",
    ]);
    expect(result.error).toBeUndefined();
  });

  it("should warn on dead categories without dropping the others", async () => {
    mockPages({
      luxury: page(
        card({ project: "Kept", studio: "Studio", live: "https://kept.com", date: awwwardsDate(24) }),
      ),
    });

    const result = await fetchAwwwards(24 * 7);

    expect(result.items).toHaveLength(1);
    expect(result.error).toBeUndefined();
    expect(result.warnings).toHaveLength(3);
  });

  it("should report an error when every category fails", async () => {
    mockPages({});

    const result = await fetchAwwwards(24 * 7);

    expect(result.items).toHaveLength(0);
    expect(result.error).toContain("HTTP 404");
  });
});
