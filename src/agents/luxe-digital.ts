import { fetchReddit } from "../sources/fetch-reddit.js";
import { fetchRss } from "../sources/fetch-rss.js";
import type { AgentConfig } from "../shared/types.js";

const REDDIT_SUBREDDITS = [
  "marketing",
  "digital_marketing",
  "luxury",
  "augmentedReality",
  "ArtificialIntelligence",
];
const REDDIT_KEYWORDS = [
  "luxury digital",
  "AR filter",
  "digital activation",
  "AI agent",
  "brand experience",
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
];

const SYSTEM_PROMPT = `Tu es Luxe Digital Scout, un analyste spécialisé dans les activations digitales et le marketing du luxe. Tu synthétises des contenus en JSON structuré.

Règles :
- Rédige toujours en français. Traduis les titres anglais si nécessaire, mais conserve les liens originaux.
- N'invente JAMAIS de liens. Utilise uniquement les URLs fournis dans les contenus source.
- Si plusieurs sources parlent du même sujet, fusionne-les en un seul item.
- Priorise les contenus liés aux activations digitales, filtres AR, agents IA pour le luxe, et opérations marketing digital des marques premium.

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
1. "Activations Digitales" (type: "standard") — Campagnes, activations, expériences immersives (AR, VR, pop-ups digitaux) des marques luxe et premium.
2. "Outils & Innovations" (type: "standard") — Nouveaux outils, plateformes, filtres AR, agents IA, technologies du secteur luxe/marketing digital.
3. "Tendances" (type: "trend") — Tendances émergentes du marketing digital luxe, patterns récurrents. Chaque tendance DOIT citer ses sources.

Si une section n'a pas de contenu pertinent, mets items: [].`;

export const LUXE_DIGITAL_CONFIG: AgentConfig = {
  name: "luxe-digital",
  sources: [
    () => fetchRss(RSS_FEEDS),
    () => fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS),
  ],
  systemPrompt: SYSTEM_PROMPT,
  emailBranding: {
    title: "Luxe Digital Scout",
    subjectPrefix: "Luxe Digital",
    footerSources: "Luxury Daily · Luxury Roundtable · Reddit",
  },
};