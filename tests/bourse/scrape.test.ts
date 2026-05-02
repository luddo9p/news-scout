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

  it("should return null when no Suivi table found", () => {
    const html = "<h2>Résultat 2025</h2><p>No suivi here</p>";
    const result = parseRenderedHtml(html);
    expect(result).toBeNull();
  });

  it("should extract performance percentage from header", () => {
    const result = parseRenderedHtml(SUIVI_2026_HTML);
    expect(result!.performance).toBe("8.50%");
  });
});