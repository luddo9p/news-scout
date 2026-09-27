import { describe, it, expect } from "vitest";
import {
  buildBourseChangeEmailHtml,
  buildBourseInitEmailHtml,
  makeBourseInitSubject,
  makeBourseSubject,
} from "../../src/bourse/email.js";
import type {
  AssetChange,
  PortfolioAsset,
  PortfolioTable,
} from "../../src/bourse/types.js";

function asset(overrides: Partial<PortfolioAsset> = {}): PortfolioAsset {
  return {
    ticker: "ABC",
    nom: "Société ABC",
    dateAchat: "12/01/2026",
    coursAchat: 100.5,
    dateVente: "",
    coursVente: 0,
    plusMinusValue: "",
    ...overrides,
  };
}

const OPEN_POSITION = asset();
const CLOSED_POSITION = asset({
  ticker: "XYZ",
  nom: "Société XYZ",
  dateVente: "03/02/2026",
  coursVente: 120,
  plusMinusValue: "+19,4%",
});

const TABLE: PortfolioTable = {
  year: 2026,
  label: "Suivi 2026",
  isCurrent: true,
  performance: "+12,4%",
  assets: [OPEN_POSITION, CLOSED_POSITION],
};

const CHANGES: AssetChange[] = [
  { type: "new_purchase", current: asset({ ticker: "NEW", nom: "Nouvelle" }) },
  {
    type: "new_sale",
    current: CLOSED_POSITION,
    previous: asset({ ticker: "XYZ", nom: "Société XYZ" }),
  },
  {
    type: "name_change",
    current: asset({ ticker: "ABC", nom: "Société ABC Renommée" }),
    previous: OPEN_POSITION,
  },
];

const DATE = new Date("2026-04-21T18:00:00Z");
const TAGS = ["table", "tr", "td", "th"];

function countOpen(html: string, tag: string): number {
  return html.split(`<${tag}`).length - 1;
}

function countClose(html: string, tag: string): number {
  return html.split(`</${tag}>`).length - 1;
}

// A stray closing tag makes email clients repair the layout on their own, which
// moves the footer out of the card. Every table tag must therefore be balanced.
function expectBalancedTags(html: string): void {
  for (const tag of TAGS) {
    expect(countOpen(html, tag), `${tag} open/close mismatch`).toBe(
      countClose(html, tag),
    );
  }
}

describe("buildBourseInitEmailHtml", () => {
  it("should render balanced table tags", () => {
    expectBalancedTags(
      buildBourseInitEmailHtml(TABLE, DATE, "Bourse Scout", "Source"),
    );
  });

  it("should list every position and the portfolio summary", () => {
    const html = buildBourseInitEmailHtml(
      TABLE,
      DATE,
      "Bourse Scout",
      "Source",
    );

    expect(html).toContain("ABC");
    expect(html).toContain("XYZ");
    expect(html).toContain("2026");
    expect(html).toContain("+12,4%");
  });
});

describe("buildBourseChangeEmailHtml", () => {
  it("should render balanced table tags with all three change types", () => {
    expectBalancedTags(
      buildBourseChangeEmailHtml(
        CHANGES,
        TABLE,
        DATE,
        "Bourse Scout",
        "Source",
      ),
    );
  });

  it("should render balanced table tags with a single change type", () => {
    expectBalancedTags(
      buildBourseChangeEmailHtml(
        [CHANGES[0]],
        TABLE,
        DATE,
        "Bourse Scout",
        "Source",
      ),
    );
  });

  it("should render balanced table tags when there is no change section", () => {
    expectBalancedTags(
      buildBourseChangeEmailHtml([], TABLE, DATE, "Bourse Scout", "Source"),
    );
  });

  it("should show each change in its own section", () => {
    const html = buildBourseChangeEmailHtml(
      CHANGES,
      TABLE,
      DATE,
      "Bourse Scout",
      "Source",
    );

    expect(html).toContain("Nouveaux achats");
    expect(html).toContain("Ventes");
    expect(html).toContain("Changements de nom");
    expect(html).toContain("Société ABC Renommée");
  });
});

describe("bourse email subjects", () => {
  it("should count the changes in the subject", () => {
    expect(makeBourseSubject(DATE, 3, "Bourse Scout")).toContain("3 changement");
  });

  it("should label the first run as a setup email", () => {
    expect(makeBourseInitSubject("Bourse Scout")).toContain("Mise en service");
  });
});
