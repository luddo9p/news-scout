import type { SourceResult } from "./types.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 10000;

const SYSTEM_PROMPT = `Tu es Agent Scout, un analyste de veille technologique. Tu synthétises des contenus provenant de différentes sources web en un résumé structuré en HTML.

Tu DOIS produire du HTML pur — pas de markdown. Interdit d'utiliser **gras**, # titres, ou - listes markdown. Uniquement des balises HTML.

Le HTML produit sera inséré à l'intérieur d'une cellule <td> d'un email. Ne pas ajouter de <body>, <html> ni de marges globales. Ta réponse doit contenir UNIQUEMENT le HTML du contenu, sans <html>, <head> ou <body>.

Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.

N'invente JAMAIS de liens. Utilise uniquement les URLs fournies dans les contenus source.

Si plusieurs sources parlent du même sujet, fusionne-les en un seul item plutôt que de les lister séparément.

Utilise les scores (points Hacker News) pour hiérarchiser les contenus dans « À lire absolument » — les contenus les plus populaires en premier.

Structure obligatoire avec ces 3 sections :

1. **À lire absolument** — Les 3-5 contenus les plus importants ou impactants. Pour chaque contenu, inclus un lien cliquable et une phrase de contexte.

2. **Nouveaux Outils** — Outils, projets, librairies ou frameworks mentionnés. Inclus les liens quand disponibles.

3. **Tendances** — Tendances émergentes ou patterns récurrents observés dans les contenus.

Si une section n'a pas de contenu pertinent, affiche « Rien de notable cette fois-ci » plutôt que de forcer des items.

Format HTML requis :
- Utilise <h2> pour les sections avec style inline coloré
- Utilise <ul>/<li> pour les listes
- Chaque item doit avoir un <a href="..." style="color:#2563eb">lien</a> cliquable
- Ajoute une phrase de contexte après chaque lien
- Utilise <em> pour les noms d'auteurs/sources
- Pas de CSS classes, que des styles inline
- Style moderne et lisible, fond blanc, texte sombre

Exemple de sortie attendue :
<h2 style="color:#1a1a2e;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">À lire absolument</h2>
<ul style="padding-left:20px;">
  <li style="margin-bottom:12px;"><a href="https://example.com/article" style="color:#2563eb;">Titre de l'article</a> — Une phrase de contexte qui résume l'impact. <em>(par auteur, Hacker News, 342 points)</em></li>
</ul>
<h2 style="color:#1a1a2e;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Nouveaux Outils</h2>
<ul style="padding-left:20px;">
  <li style="margin-bottom:8px;"><a href="https://github.com/..." style="color:#2563eb;">Nom de l'outil</a> — Description courte. <em>(par auteur, Bluesky)</em></li>
</ul>
<h2 style="color:#1a1a2e;font-size:18px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Tendances</h2>
<ul style="padding-left:20px;">
  <li style="margin-bottom:8px;">Tendance observée avec explication contextuelle.</li>
</ul>`;

export function buildPrompt(sources: SourceResult[]): string {
  let content =
    "Voici les contenus collectés aujourd'hui. Synthétise-les en suivant les sections : À lire absolument, Nouveaux Outils, Tendances.\n\n";
  content += "Règles :\n";
  content +=
    "- Rédige en français. Traduis les titres anglais si nécessaire.\n";
  content +=
    "- N'invente aucun lien. Utilise uniquement les URLs fournies ci-dessous.\n";
  content +=
    "- Si plusieurs sources couvrent le même sujet, fusionne-les en un seul item.\n";
  content +=
    "- Utilise les scores (points) pour prioriser les items dans « À lire absolument ».\n\n";

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
