import { describe, it, expect } from "vitest";
import { parseRenderedHtml } from "../../src/bourse/scrape.js";

const SUIVI_2026_HTML = `
<h2 class="wp-block-heading">Suivi 2026</h2>
<div class='csv-container'>
<table class='csv'>
<tr><th>Ticker</th><th>Nom</th><th>Date Achat</th><th>Cours Achat</th><th>Date Vente</th><th>Cours Vente</th><th>+/- Value : 8.50%</th></tr>
<tr><td>AMS:ARCAD</td><td>ARCADIS</td><td>2026-01-02</td><td> 36.14</td><td>2026-03-13</td><td> 28.58</td><td>-20.92%</td></tr>
<tr><td>EPA:CA</td><td>Carrefour</td><td>2026-01-02</td><td> 14.44</td><td></td><td> 16.66</td><td>15.37%</td></tr>
<tr><td>EPA:AL2SI</td><td>2Crsi</td><td>2026-02-06</td><td> 15.20</td><td></td><td>35.94</td><td>136.45%</td></tr>
</table>
</div>
`;

const RESULTAT_2025_HTML = `
<h2 class="wp-block-heading">Résultat 2025</h2>
<div class='csv-container'>
<table class='csv'>
<tr><th>Ticker</th><th>Nom</th><th>Date Achat</th><th>Cours Achat</th><th>Date Vente</th><th>Cours Vente</th><th>+/- Value : 0.65%</th></tr>
<tr><td>EPA:ENX</td><td>Euronext</td><td>2025-01-01</td><td>108.2</td><td>2025-05-09</td><td> 149.30</td><td>37.99%</td></tr>
</table>
</div>
`;

describe("parseRenderedHtml", () => {
  it("should parse Suivi table correctly", () => {
    const result = parseRenderedHtml(SUIVI_2026_HTML);
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.label).toBe("Suivi 2026");
    expect(result!.isCurrent).toBe(true);
    expect(result!.performance).toBe("8.50%");
    expect(result!.assets).toHaveLength(3);
  });

  it("should parse asset fields correctly", () => {
    const result = parseRenderedHtml(SUIVI_2026_HTML);
    const carrefour = result!.assets.find((a) => a.ticker === "EPA:CA");
    expect(carrefour).toBeDefined();
    expect(carrefour!.nom).toBe("Carrefour");
    expect(carrefour!.dateAchat).toBe("2026-01-02");
    expect(carrefour!.coursAchat).toBe(14.44);
    expect(carrefour!.dateVente).toBe("");
    expect(carrefour!.coursVente).toBe(16.66);
    expect(carrefour!.plusMinusValue).toBe("15.37%");
  });

  it("should parse closed position with dateVente", () => {
    const result = parseRenderedHtml(SUIVI_2026_HTML);
    const arcadis = result!.assets.find((a) => a.ticker === "AMS:ARCAD");
    expect(arcadis).toBeDefined();
    expect(arcadis!.dateVente).toBe("2026-03-13");
  });

  it("should ignore Résultat tables (only return Suivi)", () => {
    const combined = SUIVI_2026_HTML + RESULTAT_2025_HTML;
    const result = parseRenderedHtml(combined);
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.assets).toHaveLength(3);
  });

  it("should return null when no active year table found", () => {
    const html = "<h2>Résultat 2025</h2><p>No active year here</p>";
    const result = parseRenderedHtml(html);
    expect(result).toBeNull();
  });

  it("should extract performance percentage from header", () => {
    const result = parseRenderedHtml(SUIVI_2026_HTML);
    expect(result!.performance).toBe("8.50%");
  });

  // Higgons-style headings
  const EN_COURS_2026_HTML = `
  <h2 class="wp-block-heading">2026 En cours</h2>
  <div class='csv-container'>
  <table class='csv'>
  <tr><th>Ticker</th><th>Nom</th><th>Date Achat</th><th>Cours Achat</th><th>Date Vente</th><th>Cours Vente</th><th>+/- Value : 10.12%</th></tr>
  <tr><td>EPA:GLO</td><td>GL Events</td><td>2026-01-05</td><td> 42.50</td><td></td><td> 48.30</td><td>13.65%</td></tr>
  <tr><td>FRA:V02</td><td>Hoegh Autoliner</td><td>2026-02-10</td><td> 18.75</td><td>2026-04-01</td><td> 21.40</td><td>14.13%</td></tr>
  </table>
  </div>
  `;

  const RESULTAT_HIGGONS_2025_HTML = `
  <h2 class="wp-block-heading">Résultat 2025</h2>
  <div class='csv-container'>
  <table class='csv'>
  <tr><th>Ticker</th><th>Nom</th><th>Date Achat</th><th>Cours Achat</th><th>Date Vente</th><th>Cours Vente</th><th>+/- Value : 16.34%</th></tr>
  <tr><td>EPA:ALGIL</td><td>Guillin</td><td>2025-01-01</td><td> 85.20</td><td>2025-06-15</td><td> 99.10</td><td>16.31%</td></tr>
  </table>
  </div>
  `;

  it("should parse 'En cours' heading (Higgons format)", () => {
    const result = parseRenderedHtml(EN_COURS_2026_HTML);
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.label).toBe("2026 En cours");
    expect(result!.isCurrent).toBe(true);
    expect(result!.performance).toBe("10.12%");
    expect(result!.assets).toHaveLength(2);
  });

  it("should skip Résultat tables and find En cours (Higgons combined)", () => {
    const combined = RESULTAT_HIGGONS_2025_HTML + EN_COURS_2026_HTML;
    const result = parseRenderedHtml(combined);
    expect(result).not.toBeNull();
    expect(result!.year).toBe(2026);
    expect(result!.assets).toHaveLength(2);
  });

  it("should return null when only Résultat tables exist", () => {
    const result = parseRenderedHtml(RESULTAT_HIGGONS_2025_HTML);
    expect(result).toBeNull();
  });

  it("should parse Higgons asset fields correctly", () => {
    const result = parseRenderedHtml(EN_COURS_2026_HTML);
    const glo = result!.assets.find((a) => a.ticker === "EPA:GLO");
    expect(glo).toBeDefined();
    expect(glo!.nom).toBe("GL Events");
    expect(glo!.dateAchat).toBe("2026-01-05");
    expect(glo!.coursAchat).toBe(42.50);
    expect(glo!.dateVente).toBe("");
    expect(glo!.coursVente).toBe(48.30);

    const hoegh = result!.assets.find((a) => a.ticker === "FRA:V02");
    expect(hoegh!.dateVente).toBe("2026-04-01");
  });
});