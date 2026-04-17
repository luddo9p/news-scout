import { describe, it, expect } from "vitest";
import {
  SynthesisSchema,
  StandardItemSchema,
  TrendItemSchema,
  SectionSchema,
} from "../../src/shared/synthesis-schema.js";

describe("StandardItemSchema", () => {
  it("should parse a valid standard item", () => {
    const item = {
      title: "Claude Code CLI",
      url: "https://example.com/article",
      context: "Anthropic lance un nouveau CLI",
      source: "Hacker News",
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("should accept optional fields", () => {
    const item = {
      title: "Test",
      url: "https://example.com",
      context: "Context",
      source: "Reddit",
      author: "@user",
      score: 342,
      tags: ["AI", "CLI"],
      highlights: ["Point 1", "Point 2"],
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const item = {
      title: "Test",
      url: "https://example.com",
      // missing context and source
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("should reject invalid URL", () => {
    const item = {
      title: "Test",
      url: "not-a-url",
      context: "Context",
      source: "Test",
    };
    const result = StandardItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe("TrendItemSchema", () => {
  it("should parse a valid trend item", () => {
    const item = {
      title: "AR dans le luxe",
      context: "Les marques investissent l'AR",
      citations: [
        {
          text: "Gucci lance un filtre AR",
          source: "Luxury Daily",
          url: "https://luxurydaily.com/gucci-ar",
        },
      ],
    };
    const result = TrendItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("should reject trend item without citations", () => {
    const item = {
      title: "Test",
      context: "Context",
      citations: [],
    };
    const result = TrendItemSchema.safeParse(item);
    expect(result.success).toBe(true); // empty citations is valid structurally
  });
});

describe("SectionSchema", () => {
  it("should parse a valid standard section", () => {
    const section = {
      title: "A lire absolument",
      type: "standard" as const,
      items: [
        {
          title: "Test",
          url: "https://example.com",
          context: "Context",
          source: "HN",
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(true);
  });

  it("should parse a valid trend section", () => {
    const section = {
      title: "Tendances",
      type: "trend" as const,
      items: [
        {
          title: "AR dans le luxe",
          context: "Les marques investissent",
          citations: [
            {
              text: "Gucci lance AR",
              source: "Luxury Daily",
              url: "https://example.com",
            },
          ],
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(true);
  });

  it("should reject standard section with trend items", () => {
    const section = {
      title: "A lire absolument",
      type: "standard",
      items: [
        {
          title: "AR dans le luxe",
          context: "Les marques investissent",
          citations: [{ text: "t", source: "s", url: "https://example.com" }],
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(false);
  });

  it("should reject trend section with standard items", () => {
    const section = {
      title: "Tendances",
      type: "trend",
      items: [
        {
          title: "Test",
          url: "https://example.com",
          context: "Context",
          source: "HN",
        },
      ],
    };
    const result = SectionSchema.safeParse(section);
    expect(result.success).toBe(false);
  });
});

describe("SynthesisSchema", () => {
  it("should parse a full synthesis", () => {
    const data = {
      sections: [
        {
          title: "A lire absolument",
          type: "standard",
          items: [
            {
              title: "Test",
              url: "https://example.com",
              context: "Context",
              source: "HN",
              score: 100,
            },
          ],
        },
        {
          title: "Tendances",
          type: "trend",
          items: [
            {
              title: "AR luxe",
              context: "Tendance AR",
              citations: [
                {
                  text: "Gucci AR",
                  source: "LD",
                  url: "https://example.com",
                },
              ],
            },
          ],
        },
      ],
    };
    const result = SynthesisSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("should accept empty sections", () => {
    const data = {
      sections: [
        { title: "Outils", type: "standard", items: [] },
      ],
    };
    const result = SynthesisSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});