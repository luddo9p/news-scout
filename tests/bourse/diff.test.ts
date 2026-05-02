import { describe, it, expect } from "vitest";
import { computeDiff, assetKey } from "../../src/bourse/diff.js";
import type { PortfolioAsset, PortfolioTable } from "../../src/bourse/types.js";

const makeAsset = (overrides: Partial<PortfolioAsset> = {}): PortfolioAsset => ({
  ticker: "EPA:CA",
  nom: "Carrefour",
  dateAchat: "2026-01-02",
  coursAchat: 14.44,
  dateVente: "",
  coursVente: 16.66,
  plusMinusValue: "15.37%",
  ...overrides,
});

const makeTable = (assets: PortfolioAsset[], year = 2026): PortfolioTable => ({
  year,
  label: `Suivi ${year}`,
  isCurrent: true,
  performance: "8.50%",
  assets,
});

describe("assetKey", () => {
  it("should combine ticker and dateAchat", () => {
    expect(assetKey(makeAsset())).toBe("EPA:CA::2026-01-02");
  });
});

describe("computeDiff", () => {
  it("should return empty array for identical states", () => {
    const previous = makeTable([makeAsset()]);
    const current = makeTable([makeAsset()]);
    expect(computeDiff(previous, current)).toHaveLength(0);
  });

  it("should detect new purchase", () => {
    const previous = makeTable([makeAsset({ ticker: "EPA:CA" })]);
    const current = makeTable([
      makeAsset({ ticker: "EPA:CA" }),
      makeAsset({ ticker: "EPA:EL", nom: "Essilor Luxottica", dateAchat: "2026-04-17", coursAchat: 217.40 }),
    ]);
    const diff = computeDiff(previous, current);
    expect(diff).toHaveLength(1);
    expect(diff[0].type).toBe("new_purchase");
    expect(diff[0].current.ticker).toBe("EPA:EL");
  });

  it("should detect new sale", () => {
    const previous = makeTable([makeAsset({ dateVente: "" })]);
    const current = makeTable([makeAsset({ dateVente: "2026-05-01" })]);
    const diff = computeDiff(previous, current);
    expect(diff).toHaveLength(1);
    expect(diff[0].type).toBe("new_sale");
    expect(diff[0].previous).toBeDefined();
    expect(diff[0].previous!.dateVente).toBe("");
  });

  it("should detect name change", () => {
    const previous = makeTable([makeAsset({ nom: "Old Name" })]);
    const current = makeTable([makeAsset({ nom: "New Name" })]);
    const diff = computeDiff(previous, current);
    expect(diff).toHaveLength(1);
    expect(diff[0].type).toBe("name_change");
    expect(diff[0].previous!.nom).toBe("Old Name");
    expect(diff[0].current.nom).toBe("New Name");
  });

  it("should return empty when years differ", () => {
    const previous = makeTable([makeAsset()], 2025);
    const current = makeTable([makeAsset()], 2026);
    expect(computeDiff(previous, current)).toHaveLength(0);
  });

  it("should detect multiple changes at once", () => {
    const previous = makeTable([
      makeAsset({ ticker: "EPA:CA", dateVente: "" }),
      makeAsset({ ticker: "EPA:IDL", nom: "Old Name" }),
    ]);
    const current = makeTable([
      makeAsset({ ticker: "EPA:CA", dateVente: "2026-05-01" }),
      makeAsset({ ticker: "EPA:IDL", nom: "New Name" }),
      makeAsset({ ticker: "EPA:EL", nom: "Essilor", dateAchat: "2026-04-17", coursAchat: 217.40 }),
    ]);
    const diff = computeDiff(previous, current);
    expect(diff).toHaveLength(3);
    expect(diff.some((d) => d.type === "new_sale")).toBe(true);
    expect(diff.some((d) => d.type === "name_change")).toBe(true);
    expect(diff.some((d) => d.type === "new_purchase")).toBe(true);
  });

  it("should not flag already-closed positions as new sale", () => {
    const previous = makeTable([makeAsset({ dateVente: "2026-03-13" })]);
    const current = makeTable([makeAsset({ dateVente: "2026-03-13" })]);
    expect(computeDiff(previous, current)).toHaveLength(0);
  });

  it("should return empty when previous is undefined", () => {
    const current = makeTable([makeAsset()]);
    expect(computeDiff(undefined, current)).toHaveLength(0);
  });
});