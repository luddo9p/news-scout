import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRss } from "../../src/sources/fetch-rss.js";

/** Keeps fixtures inside the date window instead of hardcoding a past date. */
const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3600_000).toUTCString();

const LUXURY_DAILY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Luxury Daily</title>
    <item>
      <title>Dior launches AR try-on with Snapchat</title>
      <link>https://luxurydaily.com/dior-ar-snapchat</link>
      <description>Dior partners with Snap for virtual try-on experience targeting Gen Z luxury consumers.</description>
      <pubDate>${hoursAgo(2)}</pubDate>
    </item>
    <item>
      <title>Gucci AI lens campaign results</title>
      <link>https://luxurydaily.com/gucci-ai-lens</link>
      <description>Gucci reports 3x engagement with Sponsored AI Lens on Snapchat.</description>
      <pubDate>${hoursAgo(3)}</pubDate>
    </item>
  </channel>
</rss>`;

const EMPTY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Feed</title>
  </channel>
</rss>`;

describe("fetchRss", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should parse RSS items into ContentItems", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(LUXURY_DAILY_RSS, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://luxurydaily.com/rss", label: "Luxury Daily" },
    ]);

    expect(result.source).toBe("Luxury Daily");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: "Dior launches AR try-on with Snapchat",
      url: "https://luxurydaily.com/dior-ar-snapchat",
      source: "Luxury Daily",
    });
  });

  it("should attribute each item to its own outlet", async () => {
    const feedA = `<?xml version="1.0"?><rss version="2.0"><channel><title>A</title><item><title>From WWD</title><link>https://wwd.com/1</link></item></channel></rss>`;
    const feedB = `<?xml version="1.0"?><rss version="2.0"><channel><title>B</title><item><title>From Hypebeast</title><link>https://hypebeast.com/1</link></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(feedA, { status: 200 }))
      .mockResolvedValueOnce(new Response(feedB, { status: 200 }));

    const result = await fetchRss([
      { url: "https://wwd.com/feed/", label: "WWD" },
      { url: "https://hypebeast.com/feed", label: "Hypebeast" },
    ]);

    expect(result.items.map((item) => item.source)).toEqual(["WWD", "Hypebeast"]);
    // A merged source must never be credited to its first outlet.
    expect(result.source).toBe("2 feeds");
  });

  it("should handle empty RSS feeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(EMPTY_RSS, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://example.com/rss", label: "Empty" },
    ]);

    expect(result.items).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it("should merge multiple RSS feeds into one source", async () => {
    const feed1 = `<?xml version="1.0"?><rss version="2.0"><channel><title>F1</title><item><title>Item A</title><link>https://a.com</link><description>Desc A</description></item></channel></rss>`;
    const feed2 = `<?xml version="1.0"?><rss version="2.0"><channel><title>F2</title><item><title>Item B</title><link>https://b.com</link><description>Desc B</description></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(feed1, { status: 200 }))
      .mockResolvedValueOnce(new Response(feed2, { status: 200 }));

    const result = await fetchRss([
      { url: "https://f1.com/rss", label: "Combined" },
      { url: "https://f2.com/rss", label: "Combined" },
    ]);

    expect(result.source).toBe("Combined");
    expect(result.items).toHaveLength(2);
  });

  it("should deduplicate items by URL across feeds", async () => {
    const dupItem = `<?xml version="1.0"?><rss version="2.0"><channel><title>Dup</title><item><title>Dup</title><link>https://same.com</link><description>Same</description></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(dupItem, { status: 200 }))
      .mockResolvedValueOnce(new Response(dupItem, { status: 200 }));

    const result = await fetchRss([
      { url: "https://f1.com/rss", label: "Dedup" },
      { url: "https://f2.com/rss", label: "Dedup" },
    ]);

    expect(result.items).toHaveLength(1);
  });

  it("should handle failed feeds gracefully", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>OK</title><item><title>OK item</title><link>https://ok.com</link><description>Desc</description></item></channel></rss>`,
          { status: 200 },
        ),
      );

    const result = await fetchRss([
      { url: "https://bad.com/rss", label: "Partial" },
      { url: "https://ok.com/rss", label: "Partial" },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.error).toBeUndefined();
    // The dead feed stays visible instead of looking like an empty one
    expect(result.warnings).toEqual(["Partial (https://bad.com/rss): HTTP 404"]);
  });

  it("should report an error when every feed fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
      .mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchRss([
      { url: "https://bad.com/rss", label: "Bad" },
      { url: "https://down.com/rss", label: "Down" },
    ]);

    expect(result.items).toHaveLength(0);
    expect(result.error).toContain("HTTP 404");
    expect(result.error).toContain("Network error");
  });

  it("should keep the items of a feed whose date is unparseable", async () => {
    const brokenDate = `<?xml version="1.0"?><rss version="2.0"><channel><title>F</title><item><title>Kept item</title><link>https://kept.com</link><description>Desc</description><pubDate>not a date</pubDate></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(brokenDate, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://broken.com/rss", label: "Broken" },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Kept item");
    expect(result.items[0].date).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(result.warnings).toBeUndefined();
  });

  it("should warn about an unparseable feed without dropping the others", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("<html>not xml", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>OK</title><item><title>OK item</title><link>https://ok.com</link><description>Desc</description></item></channel></rss>`,
          { status: 200 },
        ),
      );

    const result = await fetchRss([
      { url: "https://junk.com/rss", label: "Junk" },
      { url: "https://ok.com/rss", label: "OK" },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0]).toContain("Junk");
  });

  it("should set source label from feed config", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(LUXURY_DAILY_RSS, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://luxurydaily.com/rss", label: "Luxury Daily RSS" },
    ]);

    expect(result.source).toBe("Luxury Daily RSS");
  });

  it("should parse an Atom feed (link in an attribute, title in #text)", async () => {
    const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-US">
  <title type="text">AI | The Verge</title>
  <entry>
    <title type="html">OpenAI agents tried to bruteforce a UN website</title>
    <link rel="alternate" type="text/html" href="https://www.theverge.com/ai/1001178/openai-agents"/>
    <link rel="replies" type="text/html" href="https://www.theverge.com/ai/1001178/comments"/>
    <summary type="html">A short summary.</summary>
    <published>${new Date(Date.now() - 3600_000).toISOString()}</published>
  </entry>
</feed>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(atom, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://www.theverge.com/rss/ai.xml", label: "The Verge AI" },
    ]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "OpenAI agents tried to bruteforce a UN website",
      url: "https://www.theverge.com/ai/1001178/openai-agents",
      context: "A short summary.",
    });
  });

  it("should drop items older than the default 24h window", async () => {
    const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>F</title>
      <item><title>Fresh</title><link>https://fresh.com</link><pubDate>${hoursAgo(3)}</pubDate></item>
      <item><title>Stale</title><link>https://stale.com</link><pubDate>${hoursAgo(72)}</pubDate></item>
    </channel></rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(feed, { status: 200 }),
    );

    const result = await fetchRss([{ url: "https://f.com/rss", label: "F" }]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Fresh");
  });

  it("should parse a feed with heavy entity usage instead of failing", async () => {
    // `&lt;` counts as an expansion, `&amp;` does not: 1200 of them trip the
    // parser's default limit of 1000 and used to reject the whole feed.
    const heavy = "&lt;".repeat(1200);
    const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>F</title><item><title>Entities</title><link>https://heavy.com</link><description>${heavy}</description></item></channel></rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(feed, { status: 200 }),
    );

    const result = await fetchRss([
      { url: "https://heavy.com/rss", label: "Heavy" },
    ]);

    // The parser's default 1000-expansion cap used to reject the whole feed.
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Entities");
    expect(result.error).toBeUndefined();
  });

  it("should honour a wider window for a weekly agent", async () => {
    const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>F</title>
      <item><title>Four days old</title><link>https://four.com</link><pubDate>${hoursAgo(96)}</pubDate></item>
    </channel></rss>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(feed, { status: 200 }),
    );

    const daily = await fetchRss([{ url: "https://f.com/rss", label: "F" }]);
    expect(daily.items).toHaveLength(0);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(feed, { status: 200 }),
    );

    const weekly = await fetchRss(
      [{ url: "https://f.com/rss", label: "F" }],
      24 * 7,
    );
    expect(weekly.items).toHaveLength(1);
  });
});