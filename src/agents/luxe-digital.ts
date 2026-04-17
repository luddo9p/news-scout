import { fetchBluesky } from "../sources/fetch-bluesky.js";
import { fetchReddit } from "../sources/fetch-reddit.js";
import { fetchRss } from "../sources/fetch-rss.js";
import type { AgentConfig } from "../shared/types.js";

const REDDIT_SUBREDDITS = [
  "luxury",
  "fashionbusiness",
  "augmentedReality",
  "Watches",
  "Fragrance",
];
const REDDIT_KEYWORDS = [
  "digital",
  "AR filter",
  "AI",
  "e-commerce",
  "experience",
];
const RSS_FEEDS = [
  {
    url: "https://www.luxurydaily.com/rss/feed/marketing-advertising/",
    label: "Luxury Daily",
  },
  {
    url: "https://luxuryroundtable.com/rss-feed/research/advertising-marketing/",
    label: "Luxury Roundtable",
  },
  {
    url: "https://jingdaily.com/feed/",
    label: "Jing Daily",
  },
  {
    url: "https://www.voguebusiness.com/rss",
    label: "Vogue Business",
  },
];
const BLUESKY_HASHTAGS = [
  "#Luxury",
  "#DigitalLuxury",
  "#LuxuryAR",
  "#Maison",
  "#LuxeDigital",
];

const SYSTEM_PROMPT = `Tu es Luxe Digital Scout, un analyste spécialisé dans les marques de luxe et leurs activations digitales. Tu synthétises des contenus en JSON structuré.

Règles :
- Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.
- N'invente JAMAIS de liens. Utilise uniquement les URLs fournis dans les contenus source.
- Si plusieurs sources parlent du même sujet, fusionne-les en un seul item.
- Concentre-toi UNIQUEMENT sur le luxe : marques premium, maisons de mode, horlogerie, joaillerie, parfumerie, hôtellerie de luxe, art de vivre. Ignore le marketing digital générique.
- Priorise les activations digitales, filtres AR, expériences immersives, personnalisation IA et e-commerce luxe.

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
- context : une phrase de contexte
- author? : auteur (optionnel)
- source : nom de la source
- score? : score/popularité (optionnel)
- tags? : mots-clés (optionnel, ex: ["AR", "luxury", "filtre"])
- highlights? : points clés (optionnel, 2-3 max)

Section type "trend" — items : { title, context, citations: [{ text, source, url }] }
- title : nom de la tendance
- context : description de la tendance
- citations : sources qui illustrent cette tendance

3 sections obligatoires :
1. "Activations Digitales" (type: "standard") — Campagnes digitales, activations, expériences immersives (AR, VR, pop-ups digitaux) des maisons de luxe.
2. "Innovations Luxe" (type: "standard") — Filtres AR, personnalisation IA, e-commerce luxe, nouveaux outils digitaux pour les marques premium.
3. "Tendances" (type: "trend") — Tendances émergentes du digital dans le luxe, évolutions du marché. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, mets items: [].`;

export const LUXE_DIGITAL_CONFIG: AgentConfig = {
  name: "luxe-digital",
  sources: [
    () => fetchRss(RSS_FEEDS),
    () => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS, "week"),
    () =>
      fetchBluesky(
        BLUESKY_HASHTAGS,
        process.env.BLUESKY_HANDLE,
        process.env.BLUESKY_APP_PASSWORD,
      ),
  ],
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Luxe Digital Scout",
    subjectPrefix: "Luxe Digital",
    footerSources:
      "Jing Daily · Vogue Business · Luxury Daily · Reddit · Bluesky",
  },
};