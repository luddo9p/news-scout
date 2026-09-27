import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hostOf,
  looksLikeOperation,
  pickBrandResult,
  resolveExperienceUrls,
  tokensOf,
} from "../../src/sources/resolve-experience.js";
import type { ContentItem, SourceResult } from "../../src/shared/types.js";

const OP_TITLE = "Dior launches an immersive experience";

function item(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    title: OP_TITLE,
    url: "https://www.luxurydaily.com/dior-immersive/",
    context: "Dior unveils an immersive experience for its new collection.",
    source: "Luxury Daily",
    ...overrides,
  };
}

const sourcesWith = (items: ContentItem[]): SourceResult[] => [
  { source: "2 feeds", items },
];

const BRAVE_RESPONSE = {
  web: {
    results: [
      { title: "Dior official", url: "https://www.dior.com/en_int" },
      { title: "An agency", url: "https://immersive-g.com" },
    ],
  },
};

describe("tokensOf", () => {
  it("should keep significant words and strip accents", () => {
    expect(tokensOf("Chanel dévoile une expérience immersive à Paris")).toEqual([
      "chanel",
      "paris",
    ]);
  });
});

describe("looksLikeOperation", () => {
  it("should spot a digital operation", () => {
    expect(looksLikeOperation(item())).toBe(true);
  });

  it("should ignore a plain business story", () => {
    const plain = item({ title: "Prada reports quarterly revenue", context: "Margins up." });
    expect(looksLikeOperation(plain)).toBe(false);
  });

  it("should not be triggered by an operation word buried in the description", () => {
    // Descriptions are long and noisy: only the title decides.
    const noisy = item({
      title: "Beauty Marks: The Best Beauty Looks of the Week",
      context: "A digital-first week of beauty with an immersive experience in Paris.",
    });
    expect(looksLikeOperation(noisy)).toBe(false);
  });

  it("should ignore hardware news, which is not a brand operation", () => {
    const hardware = item({
      title: "Meta VR Glasses Hands-on: What Apple Vision Pro Probably Should Have",
      context: "Our impressions of the new headset.",
    });
    expect(looksLikeOperation(hardware)).toBe(false);
  });

  it("should spot the words luxury houses use for their activations", () => {
    expect(looksLikeOperation(item({ title: "Dior launches an AR try-on with Snapchat" }))).toBe(
      true,
    );
  });
});

describe("hostOf", () => {
  it("should strip www and return nothing for a broken URL", () => {
    expect(hostOf("https://www.dior.com/x")).toBe("dior.com");
    expect(hostOf("not a url")).toBe("");
  });
});

describe("pickBrandResult", () => {
  it("should prefer a host starting with a brand word", () => {
    const url = pickBrandResult(
      [
        { url: "https://thediorblog.com/review" },
        { url: "https://www.dior.com/en_int" },
      ],
      ["dior"],
    );
    expect(url).toBe("https://www.dior.com/en_int");
  });

  it("should accept a host that merely contains a brand word", () => {
    expect(pickBrandResult([{ url: "https://maison-dior.example" }], ["dior"])).toBe(
      "https://maison-dior.example",
    );
  });

  it("should ignore press and social results", () => {
    expect(
      pickBrandResult(
        [
          { url: "https://wwd.com/story" },
          { url: "https://instagram.com/dior" },
        ],
        ["dior"],
      ),
    ).toBeUndefined();
  });

  it("should return nothing rather than a wrong link", () => {
    expect(pickBrandResult([{ url: "https://xydrobe.com" }], ["dior"])).toBeUndefined();
  });
});

describe("resolveExperienceUrls", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BRAVE_API_KEY;
  });

  it("should attach the brand site found through the Brave API", async () => {
    process.env.BRAVE_API_KEY = "test-key";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(BRAVE_RESPONSE), { status: 200 }));

    const result = await resolveExperienceUrls(sourcesWith([item()]));

    expect(result[0].items[0].experienceUrl).toBe("https://www.dior.com/en_int");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("api.search.brave.com");
  });

  it("should fall back to DuckDuckGo when no key is configured", async () => {
    delete process.env.BRAVE_API_KEY;
    const ddgHtml = `<a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent("https://www.dior.com/fr_fr")}">Dior</a>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(ddgHtml, { status: 200 }));

    const result = await resolveExperienceUrls(sourcesWith([item()]));

    expect(result[0].items[0].experienceUrl).toBe("https://www.dior.com/fr_fr");
  });

  it("should not search when no item looks like an operation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const sources = sourcesWith([
      item({ title: "Prada reports quarterly revenue", context: "Margins up." }),
    ]);

    const result = await resolveExperienceUrls(sources);

    expect(result).toBe(sources);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should leave the items untouched when the search fails", async () => {
    process.env.BRAVE_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    const result = await resolveExperienceUrls(sourcesWith([item()]));

    expect(result[0].items[0].experienceUrl).toBeUndefined();
    expect(result[0].items[0].title).toBe(OP_TITLE);
  });

  it("should keep the other sources intact", async () => {
    process.env.BRAVE_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(BRAVE_RESPONSE), { status: 200 }),
    );
    const sources: SourceResult[] = [
      { source: "2 feeds", items: [item()] },
      { source: "Bluesky", items: [item({ url: "https://bsky.app/1", title: "Bluesky post" })] },
    ];

    const result = await resolveExperienceUrls(sources);

    expect(result[1].source).toBe("Bluesky");
    expect(result[1].items).toHaveLength(1);
  });
});
