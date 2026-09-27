import { fetchBluesky } from "../sources/fetch-bluesky.js";
import { fetchHackerNews } from "../sources/fetch-hackernews.js";
import { fetchMastodon } from "../sources/fetch-mastodon.js";
import { fetchDevTo } from "../sources/fetch-devto.js";
import { fetchRss } from "../sources/fetch-rss.js";
import { fetchTerminalFeed } from "../sources/fetch-terminalfeed.js";
import { fetchLobsters } from "../sources/fetch-lobsters.js";
import type { AgentConfig } from "../shared/types.js";
import type { RssFeedConfig } from "../sources/fetch-rss.js";

const BLUESKY_HASHTAGS = [
  "#vibecoding",
  "#vibecode",
  "#claudecode",
  "#claude",
  "#codex",
  "#IA",
];
const HN_QUERIES = ["AI", "LLM"];
// Kept although the Reddit source is currently unwired: see the note in `sources`.
const REDDIT_SUBREDDITS = [
  "MachineLearning",
  "LocalLLaMA",
  "ChatGPT",
  "ClaudeAI",
  "coding",
];
const REDDIT_KEYWORDS = ["AI", "LLM", "vibe coding", "Claude"];
const MASTODON_HASHTAGS = ["#AI", "#LLM", "#vibecoding", "#claude"];
const DEVTO_TAGS = ["ai", "llm"];
const RSS_AI_FEEDS: RssFeedConfig[] = [
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", label: "The Verge AI" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", label: "Ars Technica" },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", label: "TechCrunch AI" },
  { url: "https://openai.com/news/rss.xml", label: "OpenAI News" },
  { url: "https://blog.google/technology/ai/rss/", label: "Google AI" },
  { url: "https://deepmind.google/blog/rss.xml", label: "Google DeepMind" },
  { url: "https://huggingface.co/blog/feed.xml", label: "Hugging Face" },
  { url: "https://simonwillison.net/atom/everything/", label: "Simon Willison" },
  { url: "https://www.latent.space/feed", label: "Latent Space" },
  { url: "https://importai.substack.com/feed", label: "Import AI" },
  { url: "https://www.wired.com/feed/tag/ai/latest/rss", label: "Wired AI" },
];

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
    // Reddit is unwired: oauth.reddit.com answers 403 (an HTML challenge page, not a
    // 401) to a datacenter IP even with a valid OAuth token, so it returned 0 item in
    // every measured run. The module and its tests are kept in
    // `src/sources/fetch-reddit.ts`; re-add
    // `() => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS),` here to switch it back on.
    () => fetchMastodon(MASTODON_HASHTAGS),
    () => fetchDevTo(DEVTO_TAGS),
    () => fetchRss(RSS_AI_FEEDS),
    () => fetchTerminalFeed(),
    () => fetchLobsters(),
  ],
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Agent Scout",
    subjectPrefix: "Agent Scout",
    footerSources: "Bluesky · Hacker News · Mastodon · Dev.to · RSS · GitHub Trending · Lobste.rs",
  },
};