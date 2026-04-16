import type { SourceResult } from "./types.js";

const DEFAULT_MODEL = "glm-5.1:cloud";
const TIMEOUT_MS = 300000;
const MAX_ITEMS_PER_SOURCE = 5;
const MAX_SUMMARY_LENGTH = 100;

export function buildPrompt(sources: SourceResult[]): string {
  let content =
    "Voici les contenus collectés aujourd'hui. Synthétise-les en suivant les sections définies dans le prompt système.\n\n";
  content += "Règles :\n";
  content +=
    "- Rédige en français. Traduis les titres anglais si nécessaire.\n";
  content +=
    "- N'invente aucun lien. Utilise uniquement les URLs fournies ci-dessous.\n";
  content +=
    "- Si plusieurs sources couvrent le même sujet, fusionne-les en un seul item.\n";
  content +=
    "- Utilise les scores (points) pour prioriser les items dans les sections importantes.\n\n";

  for (const source of sources) {
    content += `## Source : ${source.source}\n`;
    if (source.error) {
      content += `⚠️ Erreur : ${source.error}\n\n`;
      continue;
    }
    if (source.items.length === 0) {
      content += "(Aucun contenu trouvé)\n\n";
      continue;
    }
    const items = source.items
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, MAX_ITEMS_PER_SOURCE);
    for (const item of items) {
      const summary =
        item.summary.length > MAX_SUMMARY_LENGTH
          ? item.summary.slice(0, MAX_SUMMARY_LENGTH) + "..."
          : item.summary;
      content += `- **${item.title}**`;
      if (item.author) content += ` (par ${item.author})`;
      if (item.score) content += ` [${item.score} points]`;
      content += `\n  Lien : ${item.url}`;
      content += `\n  Résumé : ${summary}\n`;
    }
    content += "\n";
  }

  return content;
}

export async function synthesize(
  sources: SourceResult[],
  vpsUrl: string,
  systemPrompt: string,
  apiKey?: string,
): Promise<string> {
  const userPrompt = buildPrompt(sources);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await fetch(`${vpsUrl}/generate`, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        prompt: userPrompt,
        systemPrompt,
        model: DEFAULT_MODEL,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const htmlContent: string = data.content;

    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error("Ollama returned empty content");
    }

    return htmlContent;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Ollama API timeout");
    }
    throw err;
  }
}