import { fetchBluesky } from "../sources/fetch-bluesky.js";
import { fetchHackerNews } from "../sources/fetch-hackernews.js";
import { fetchReddit } from "../sources/fetch-reddit.js";
import { fetchTwitter } from "../sources/fetch-twitter.js";
import type { AgentConfig } from "../shared/types.js";

const BLUESKY_HASHTAGS = [
  "#vibecoding",
  "#vibecode",
  "#claudecode",
  "#claude",
  "#codex",
  "#IA",
];
const HN_QUERIES = ["AI", "LLM"];
const REDDIT_SUBREDDITS = [
  "MachineLearning",
  "LocalLLaMA",
  "ChatGPT",
  "ClaudeAI",
  "coding",
];
const REDDIT_KEYWORDS = ["AI", "LLM", "vibe coding", "Claude"];
const TWITTER_SEARCH_TERMS = ["#vibecoding", "#IA", "vibe coding", "AI tools"];

const SYSTEM_PROMPT = `Tu es Agent Scout, un analyste de veille technologique. Tu synthétises des contenus en JSON structuré.

Règles :
- Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.
- N'invente JAMAIS de liens. Utilise uniquement les URLs fournis dans les contenus source.
- Si plusieurs sources parlent du même sujet, fusionne-les en un seul item.
- Utilise les scores (points) pour hiérarchiser les contenus dans « À lire absolument » — les contenus les plus populaires en premier.

Retourne UNIQUEMENT du JSON valide (pas de markdown, pas de texte avant/après).

Schéma :
{
  "sections": [
    {
      "title": "string",
      "type": "standard" | "trend",
      "items": [...]
    }
  ]
}

Section type "standard" — items : { title, url, context, author?, source, score?, tags?[], highlights?[] }
- title : titre de l'article/outil
- url : lien original
- context : une phrase de contexte qui résume l'impact ou l'intérêt
- author? : auteur ou compte (optionnel)
- source : nom de la source (ex: Hacker News, Reddit, Bluesky)
- score? : score/popularité (optionnel)
- tags? : mots-clés pertinents (optionnel, ex: ["CLI", "AI"])
- highlights? : points clés (optionnel, 2-3 max)

Section type "trend" — items : { title, context, citations: [{ text, source, url }] }
- title : nom de la tendance
- context : description de la tendance
- citations : liste des sources qui illustrent cette tendance

3 sections obligatoires :
1. "À lire absolument" (type: "standard") — Les 3-5 contenus les plus importants ou impactants.
2. "Nouveaux Outils" (type: "standard") — Outils, projets, librairies ou frameworks mentionnés.
3. "Tendances" (type: "trend") — Tendances émergentes ou patterns récurrents. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, mets items: [].`;

export const TECH_AI_CONFIG: AgentConfig = {
  name: "tech-ai",
  sources: [
    () =>
      fetchBluesky(
        BLUESKY_HASHTAGS,
        process.env.BLUESKY_HANDLE,
        process.env.BLUESKY_APP_PASSWORD,
      ),
    () => fetchHackerNews(HN_QUERIES),
    () => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS),
    () =>
      fetchTwitter(TWITTER_SEARCH_TERMS, process.env.APIFY_API_KEY || ""),
  ],
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Agent Scout",
    subjectPrefix: "Agent Scout",
    footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
  },
};