import type { SourceResult } from "./types.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `Tu es Agent Scout, un analyste de veille technologique. Tu synthétises des contenus provenant de différentes sources web en un résumé structuré en HTML.

Tu DOIS produire du HTML valide avec des styles inline (compatible clients email). Ta réponse doit contenir UNIQUEMENT le HTML du corps de l'email, sans <html>, <head> ou <body>.

Structure obligatoire avec ces 3 sections :

1. **À lire absolument** — Les 3-5 contenus les plus importants ou impactants. Pour chaque contenu, inclus un lien cliquable et une phrase de contexte.

2. **Nouveaux Outils** — Outils, projets, librairies ou frameworks mentionnés. Inclus les liens quand disponibles.

3. **Tendances** — Tendances émergentes ou patterns récurrents observés dans les contenus.

Format HTML requis :
- Utilise <h2> pour les sections avec style inline coloré
- Utilise <ul>/<li> pour les listes
- Chaque item doit avoir un <a href="..." style="color:#2563eb">lien</a> cliquable
- Ajoute une phrase de contexte après chaque lien
- Utilise <em> pour les noms d'auteurs/sources
- Pas de CSS classes, que des styles inline
- Style moderne et lisible, fond blanc, texte sombre`;

export function buildPrompt(sources: SourceResult[]): string {
  let content =
    "Voici les contenus collectés aujourd'hui. Synthétise-les en suivant les sections : À lire absolument, Nouveaux Outils, Tendances.\n\n";

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
    for (const item of source.items) {
      content += `- **${item.title}**`;
      if (item.author) content += ` (par ${item.author})`;
      if (item.score) content += ` [${item.score} points]`;
      content += `\n  Lien : ${item.url}`;
      content += `\n  Résumé : ${item.summary}\n`;
    }
    content += "\n";
  }

  return content;
}

export async function synthesize(
  sources: SourceResult[],
  apiKey: string,
): Promise<string> {
  const userPrompt = buildPrompt(sources);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const htmlContent: string = data.choices?.[0]?.message?.content;

    if (!htmlContent) {
      throw new Error("Groq returned empty content");
    }

    return htmlContent;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
