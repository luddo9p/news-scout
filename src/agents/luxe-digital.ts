import { fetchBluesky } from "../sources/fetch-bluesky.js";
import { fetchRss } from "../sources/fetch-rss.js";
import { resolveExperienceUrls } from "../sources/resolve-experience.js";
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
    url: "https://www.luxurydaily.com/feed/",
    label: "Luxury Daily",
  },
  {
    url: "https://luxuryroundtable.com/feed/",
    label: "Luxury Roundtable",
  },
  {
    url: "https://wwd.com/feed/",
    label: "WWD",
  },
  {
    url: "https://www.vogue.com/feed/rss",
    label: "Vogue",
  },
  {
    url: "https://hypebeast.com/feed",
    label: "Hypebeast",
  },
  {
    url: "https://www.highsnobiety.com/feed/",
    label: "Highsnobiety",
  },
  {
    url: "https://www.retaildive.com/feeds/news/",
    label: "Retail Dive",
  },
  {
    url: "https://hodinkee.com/articles.rss",
    label: "Hodinkee",
  },
  {
    url: "https://www.roadtovr.com/feed/",
    label: "Road to VR",
  },
];
/** The agent runs once a week: a 24 h window would only ever see a single day. */
const RSS_MAX_AGE_HOURS = 24 * 7;
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
- Pour « Expériences à visiter », utilise en priorité le « Lien de l'expérience » fourni pour certains items : c'est le site ou le microsite de la marque, retrouvé par recherche. N'utilise jamais l'URL d'un article de presse comme lien d'expérience.
- Ne mentionne jamais le studio, l'agence ou le développeur qui a réalisé une expérience : les agences sont souvent tenues par la confidentialité de la marque. Parle uniquement de la marque et de ce que l'on vit sur son site.
- Décris chaque expérience en 2 ou 3 points dans \`highlights\` : ce qu'on y vit, le type d'interaction, la technologie (WebGL, 3D, scroll immersif, AR) et le parti pris visuel.

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

4 sections obligatoires :
1. "Expériences à visiter" (type: "standard") — Sites et expériences immersives de marque que l'on peut réellement ouvrir en ligne, repérés dans les news luxe. 3 à 5 expériences.
2. "Activations Digitales" (type: "standard") — Campagnes digitales, activations, expériences immersives (AR, VR, pop-ups digitaux) des maisons de luxe.
3. "Innovations Luxe" (type: "standard") — Filtres AR, personnalisation IA, e-commerce luxe, nouveaux outils digitaux pour les marques premium.
4. "Tendances" (type: "trend") — Tendances émergentes du digital dans le luxe, évolutions du marché. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, mets items: [].`;

export const LUXE_DIGITAL_CONFIG: AgentConfig = {
  name: "luxe-digital",
  sources: [
    () => fetchRss(RSS_FEEDS, RSS_MAX_AGE_HOURS),
    // Awwwards is unwired: this veille is about operations the awards galleries do
    // not cover. The module and its tests are kept in `src/sources/fetch-awwwards.ts`;
    // re-add `() => fetchAwwwards(RSS_MAX_AGE_HOURS),` here to switch it back on.
    // Reddit is unwired: oauth.reddit.com answers 403 (an HTML challenge page, not a
    // 401) to a datacenter IP even with a valid OAuth token. The module and its tests
    // are kept in `src/sources/fetch-reddit.ts`; re-add
    // `() => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS, "week"),` here to switch
    // it back on.
    () =>
      fetchBluesky(
        BLUESKY_HASHTAGS,
        process.env.BLUESKY_HANDLE,
        process.env.BLUESKY_APP_PASSWORD,
      ),
  ],
  enrich: resolveExperienceUrls,
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Luxe Digital Scout",
    subjectPrefix: "Luxe Digital",
    footerSources:
      "Luxury Daily · Luxury Roundtable · WWD · Vogue · Hypebeast · Highsnobiety · Retail Dive · Hodinkee · Road to VR · Bluesky",
  },
};