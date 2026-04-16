import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRss } from "../../src/sources/fetch-rss.js";

const LUXURY_DAILY_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Luxury Daily</title>
    <item>
      <title>Dior launches AR try-on with Snapchat</title>
      <link>https://luxurydaily.com/dior-ar-snapchat</link>
      <description>Dior partners with Snap for virtual try-on experience targeting Gen Z luxury consumers.</description>
      <pubDate>Mon, 14 Apr 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Gucci AI lens campaign results</title>
      <link>https://luxurydaily.com/gucci-ai-lens</link>
      <description>Gucci reports 3x engagement with Sponsored AI Lens on Snapchat.</description>
      <pubDate>Mon, 14 Apr 2026 10:00:00 GMT</pubDate>
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
      source: "RSS",
    });
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
});