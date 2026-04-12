import type { SourceResult } from "./types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 30000;
const MAX_ITEMS_PER_SOURCE = 10;
const MAX_SUMMARY_LENGTH = 150;

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
- Chaque item doit avoir un <a href="..." style="color:#007AFF;text-decoration:none;font-weight:500;">lien</a> cliquable
- Ajoute une phrase de contexte après chaque lien
- Utilise <em> pour les noms d'auteurs/sources
- Pas de CSS classes, que des styles inline
- Style moderne et lisible, fond blanc, texte sombre

Exemple de sortie attendue :
<h2 style="font-size:20px;font-weight:700;color:#1c1c1e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e5ea;">À lire absolument</h2>
<ul style="padding-left:0;list-style:none;margin:0 0 28px;">
  <li style="margin-bottom:16px;"><a href="https://example.com/article" style="color:#007AFF;text-decoration:none;font-weight:500;">Titre de l'article</a><span style="color:#3c3c43;"> — Une phrase de contexte qui résume l'impact.</span> <em style="color:#8e8e93;font-size:13px;">(par auteur, Hacker News, 342 points)</em></li>
</ul>
<h2 style="font-size:20px;font-weight:700;color:#1c1c1e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e5ea;">Nouveaux Outils</h2>
<ul style="padding-left:0;list-style:none;margin:0 0 28px;">
  <li style="margin-bottom:16px;"><a href="https://github.com/..." style="color:#007AFF;text-decoration:none;font-weight:500;">Nom de l'outil</a><span style="color:#3c3c43;"> — Description courte.</span> <em style="color:#8e8e93;font-size:13px;">(par auteur, Bluesky)</em></li>
</ul>
<h2 style="font-size:20px;font-weight:700;color:#1c1c1e;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e5e5ea;">Tendances</h2>
<ul style="padding-left:0;list-style:none;margin:0;">
  <li style="margin-bottom:12px;color:#3c3c43;">Tendance observée avec explication contextuelle.</li>
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
    // Limit items and truncate summaries to stay within token limits
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
  apiKey: string,
): Promise<string> {
  const userPrompt = buildPrompt(sources);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const result = await Promise.race([
      model.generateContent(userPrompt),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () =>
          reject(new Error("Gemini API timeout")),
        ),
      ),
    ]);

    clearTimeout(timeout);

    const htmlContent = result.response.text();

    if (!htmlContent || htmlContent.trim().length === 0) {
      throw new Error("Gemini returned empty content");
    }

    return htmlContent;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
