import * as cheerio from "cheerio";
import type { PortfolioAsset, PortfolioTable } from "./types.js";

export interface ScrapeResult {
  suivi: PortfolioTable | null;
  error?: string;
}

const WP_API_URL =
  "https://www.bourse-portefeuille-conseil.fr/wp-json/wp/v2/pages/1094";

export async function fetchAndParsePortfolio(
  apiUrl: string = WP_API_URL,
): Promise<ScrapeResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { suivi: null, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    const renderedHtml: string = data?.content?.rendered ?? "";

    if (!renderedHtml) {
      return { suivi: null, error: "No rendered content in API response" };
    }

    const suivi = parseRenderedHtml(renderedHtml);
    if (!suivi) {
      return { suivi: null, error: "No Suivi table found in rendered content" };
    }

    return { suivi };
  } catch (err) {
    return {
      suivi: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function parseRenderedHtml(html: string): PortfolioTable | null {
  const $ = cheerio.load(html);

  const headings = $("h2.wp-block-heading, h2").toArray();
  for (const heading of headings) {
    const text = $(heading).text().trim();
    const match = text.match(/Suivi\s+(\d{4})/i);
    if (!match) continue;

    const year = parseInt(match[1], 10);
    const table = $(heading).next("div.csv-container").find("table.csv");

    if (table.length === 0) continue;

    const assets = parseTable($, table);
    const performance = extractPerformance($, table);

    return {
      year,
      label: text,
      isCurrent: true,
      performance,
      assets,
    };
  }

  return null;
}

function parseTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<any>,
): PortfolioAsset[] {
  const rows = table.find("tr").toArray();
  const assets: PortfolioAsset[] = [];

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const cells = $(rows[i]).find("td").toArray();
    if (cells.length < 7) continue;

    const ticker = $(cells[0]).text().trim();
    const nom = $(cells[1]).text().trim();
    const dateAchat = $(cells[2]).text().trim();
    const coursAchat = parseFloat($(cells[3]).text().trim());
    const dateVente = $(cells[4]).text().trim();
    const coursVente = parseFloat($(cells[5]).text().trim());
    const plusMinusValue = $(cells[6]).text().trim();

    if (!ticker || !dateAchat) continue;

    assets.push({
      ticker,
      nom,
      dateAchat,
      coursAchat: isNaN(coursAchat) ? 0 : coursAchat,
      dateVente,
      coursVente: isNaN(coursVente) ? 0 : coursVente,
      plusMinusValue,
    });
  }

  return assets;
}

function extractPerformance(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<any>,
): string {
  const headerRow = table.find("tr").first();
  const lastTh = headerRow.find("th").last().text().trim();
  const match = lastTh.match(/([\d.-]+%)/);
  return match ? match[1] : "";
}