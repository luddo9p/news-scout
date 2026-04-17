import { describe, it, expect } from "vitest";
import { renderSections } from "../../src/shared/render.js";
import type { SynthesisData } from "../../src/shared/synthesis-schema.js";

describe("renderSections", () => {
  it("should render a standard section with items", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "À lire absolument",
          type: "standard",
          items: [
            {
              title: "Claude Code CLI",
              url: "https://example.com/claude-code",
              context: "Anthropic lance un nouveau CLI pour les développeurs",
              source: "Hacker News",
              score: 342,
              author: "@anthropic",
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).toContain("À lire absolument");
    expect(html).toContain("<h2");
    expect(html).toContain("Claude Code CLI");
    expect(html).toContain('href="https://example.com/claude-code"');
    expect(html).toContain("Anthropic lance un nouveau CLI");
    expect(html).toContain("342 points");
    expect(html).toContain("@anthropic");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
  });

  it("should render tags as plain text separated by middle dots", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Outils",
          type: "standard",
          items: [
            {
              title: "Test Tool",
              url: "https://example.com",
              context: "A tool",
              source: "Reddit",
              tags: ["AI", "CLI"],
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).toContain("AI · CLI");
  });

  it("should render highlights as a sub-list", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Outils",
          type: "standard",
          items: [
            {
              title: "Test Tool",
              url: "https://example.com",
              context: "A tool",
              source: "Reddit",
              highlights: ["Feature A", "Feature B"],
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).toContain("Feature A");
    expect(html).toContain("Feature B");
  });

  it("should render a trend section with citations", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Tendances",
          type: "trend",
          items: [
            {
              title: "AR dans le luxe",
              context: "Les marques investissent dans les filtres AR",
              citations: [
                {
                  text: "Gucci lance un filtre AR sur Snapchat",
                  source: "Luxury Daily",
                  url: "https://luxurydaily.com/gucci",
                },
                {
                  text: "Reddit discute des filtres AR",
                  source: "r/luxury",
                  url: "https://reddit.com/r/luxury/1",
                },
              ],
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).toContain("AR dans le luxe");
    expect(html).toContain("Les marques investissent");
    expect(html).toContain("Gucci lance un filtre AR");
    expect(html).toContain("Luxury Daily");
    expect(html).toContain('href="https://luxurydaily.com/gucci"');
    expect(html).toContain("Reddit discute des filtres AR");
    expect(html).toContain("r/luxury");
  });

  it("should render empty section message when items is empty", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Outils",
          type: "standard",
          items: [],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).toContain("Rien de notable cette fois-ci");
  });

  it("should not render tags when absent", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Item",
              url: "https://example.com",
              context: "Ctx",
              source: "SRC",
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).not.toContain("·");
  });

  it("should not render highlights when absent", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Item",
              url: "https://example.com",
              context: "Ctx",
              source: "SRC",
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    const nestedUlMatch = html.match(/<li[^>]*>[\s\S]*?<ul/g);
    expect(nestedUlMatch).toBeNull();
  });

  it("should handle multiple sections", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "À lire absolument",
          type: "standard",
          items: [
            {
              title: "Item 1",
              url: "https://example.com/1",
              context: "Ctx 1",
              source: "HN",
            },
          ],
        },
        {
          title: "Tendances",
          type: "trend",
          items: [
            {
              title: "Trend 1",
              context: "Ctx trend",
              citations: [
                {
                  text: "Citation",
                  source: "SRC",
                  url: "https://example.com/2",
                },
              ],
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).toContain("À lire absolument");
    expect(html).toContain("Tendances");
    expect(html).toContain("Item 1");
    expect(html).toContain("Trend 1");
  });

  it("should use only inline styles, no CSS classes", () => {
    const data: SynthesisData = {
      sections: [
        {
          title: "Test",
          type: "standard",
          items: [
            {
              title: "Item",
              url: "https://example.com",
              context: "Ctx",
              source: "SRC",
            },
          ],
        },
      ],
    };
    const html = renderSections(data);
    expect(html).not.toMatch(/class=/);
    expect(html).toMatch(/style="/);
  });
});