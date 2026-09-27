import { SynthesisSchema } from "./synthesis-schema.js";
import type { SynthesisData } from "./synthesis-schema.js";
import type { ContentItem, SourceResult } from "./types.js";

const DEFAULT_MODEL = "deepseek-v4.1-flash:cloud";
const TIMEOUT_MS = 300000;
const MAX_TOTAL_ITEMS = 15;
const REDUCED_TOTAL_ITEMS = 10;
const MAX_SUMMARY_LENGTH = 80;

export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return raw.trim();
}

export function parseSynthesis(
  raw: string,
): { data: SynthesisData } | { error: string } {
  const extracted = extractJson(raw);
  let json: unknown;
  try {
    json = JSON.parse(extracted);
  } catch (e) {
    return { error: `JSON parse error: ${(e as Error).message}` };
  }
  const parsed = SynthesisSchema.safeParse(json);
  if (parsed.success) return { data: parsed.data };
  return { error: parsed.error.message };
}

export function buildPrompt(sources: SourceResult[], maxTotal = MAX_TOTAL_ITEMS): string {
  let content =
    "Voici les contenus collectés aujourd'hui. Synthétise-les en suivant les sections définies dans le prompt système.\n\n";
  content += "Règles :\n";
  content += "- Rédige en français. Traduis les titres anglais si nécessaire.\n";
  content += "- N'invente aucun lien. Utilise uniquement les URLs fournis ci-dessous.\n";
  content += "- Si plusieurs sources couvrent le même sujet, fusionne-les en un seul item.\n";
  content += "- Utilise les scores (points) pour prioriser les items dans les sections importantes.\n\n";

  // Merge all items, sort by score, keep top N globally
  // Fair share first: every source gets up to `quota` slots before scoring decides.
  // Without it a small curated source (8 Awwwards experiences) is wiped out by a
  // firehose like Luxury Daily, or by the scores Hacker News and GitHub always carry.
  const rankedPerSource = sources
    .filter((s) => !s.error && s.items.length > 0)
    .map((s) => [...s.items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)));

  const quota =
    rankedPerSource.length > 0
      ? Math.max(1, Math.floor(maxTotal / rankedPerSource.length))
      : 0;

  const selected: ContentItem[] = [];
  for (const ranked of rankedPerSource) {
    for (let taken = 0; taken < quota && selected.length < maxTotal; taken++) {
      const [next] = ranked.splice(0, 1);
      if (!next) break;
      selected.push(next);
    }
  }

  const byScore = rankedPerSource
    .flat()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (const item of byScore) {
    if (selected.length >= maxTotal) break;
    selected.push(item);
  }

  for (const item of selected) {
    const ctx =
      item.context.length > MAX_SUMMARY_LENGTH
        ? item.context.slice(0, MAX_SUMMARY_LENGTH) + "..."
        : item.context;
    content += `- **${item.title}**`;
    if (item.author) content += ` (par ${item.author})`;
    if (item.score) content += ` [${item.score} points]`;
    content += ` [${item.source}]`;
    content += `\n  Lien : ${item.url}`;
    if (item.experienceUrl) {
      content += `\n  Lien de l'expérience : ${item.experienceUrl}`;
    }
    content += `\n  Contexte : ${ctx}\n`;
  }

  return content;
}

async function callOllama(
  userPrompt: string,
  systemPrompt: string,
  vpsUrl: string,
  apiKey?: string,
): Promise<string> {
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
    const content: string = data.content;

    if (!content || content.trim().length === 0) {
      throw new Error("Ollama returned empty content");
    }

    return content;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Ollama API timeout");
    }
    throw err;
  }
}

export async function synthesize(
  sources: SourceResult[],
  vpsUrl: string,
  systemPrompt: string,
  apiKey?: string,
): Promise<SynthesisData> {
  // Attempt 1: full prompt
  const raw = await callOllama(buildPrompt(sources), systemPrompt, vpsUrl, apiKey);
  const first = parseSynthesis(raw);
  if ("data" in first) return first.data;

  console.warn(
    `[synthesize] First attempt returned invalid JSON, retrying. Error: ${first.error}`,
  );

  // Attempt 2: retry with corrected JSON
  const retryUserPrompt = `Ton JSON précédent était invalide. Erreur : ${first.error}. Retourne UNIQUEMENT du JSON valide respectant le schéma.`;
  const retryRaw = await callOllama(
    retryUserPrompt,
    systemPrompt,
    vpsUrl,
    apiKey,
  );
  const retry = parseSynthesis(retryRaw);
  if ("data" in retry) return retry.data;

  // Attempt 3: reduced prompt with fewer items
  console.warn(
    "[synthesize] Second attempt still invalid, retrying with reduced prompt.",
  );
  const reducedRaw = await callOllama(
    buildPrompt(sources, REDUCED_TOTAL_ITEMS),
    systemPrompt,
    vpsUrl,
    apiKey,
  );
  const reduced = parseSynthesis(reducedRaw);
  if ("data" in reduced) return reduced.data;

  throw new Error(`Synthesis JSON invalid after retry: ${reduced.error}`);
}