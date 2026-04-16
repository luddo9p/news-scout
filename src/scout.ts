import { fetchBluesky } from "./fetch-bluesky.js";
import { fetchHackerNews } from "./fetch-hackernews.js";
import { fetchReddit } from "./fetch-reddit.js";
import { fetchTwitter } from "./fetch-twitter.js";
import { synthesize } from "./shared/synthesize.js";
import { buildEmailHtml, makeEmailSubject, sendEmail } from "./shared/send-email.js";
import type { ScoutResult, SourceResult, EmailBranding } from "./shared/types.js";

const SCOUT_BRANDING: EmailBranding = {
  title: "Agent Scout",
  subjectPrefix: "Agent Scout",
  footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
};

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

	3. **Tendances** — Tendances émergentes ou patterns récurrents observés dans les contenus. Chaque tendance DOIT citer ses sources entre parenthèses avec le nom de la source (Bluesky, Hacker News, Reddit, X/Twitter) et un lien vers le contenu origine quand c'est pertinent.

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
	  <li style="margin-bottom:12px;color:#3c3c43;">Tendance observée avec explication contextuelle. <em style="color:#8e8e93;font-size:13px;">(Bluesky, Hacker News, Reddit, X/Twitter)</em></li>
	</ul>`;

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

export async function runScout(): Promise<ScoutResult> {
  console.log("[Agent Scout] Starting scout run...");
  const startTime = Date.now();

  // 1. Fetch all sources in parallel
  console.log("[Agent Scout] Fetching sources...");
  const blueskyHandle = process.env.BLUESKY_HANDLE;
  const blueskyAppPassword = process.env.BLUESKY_APP_PASSWORD;
  const results = await Promise.allSettled([
    fetchBluesky(BLUESKY_HASHTAGS, blueskyHandle, blueskyAppPassword),
    fetchHackerNews(HN_QUERIES),
    fetchReddit(REDDIT_SUBREDDITS, REDDIT_KEYWORDS),
    fetchTwitter(TWITTER_SEARCH_TERMS, process.env.APIFY_API_KEY || ""),
  ]);

  const sources: SourceResult[] = results.map((result, index) => {
    const sourceNames = ["Bluesky", "Hacker News", "Reddit", "X/Twitter"];
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      source: sourceNames[index],
      items: [],
      error: result.reason?.message || String(result.reason),
    };
  });

  const sourcesFetched = sources.filter((s) => !s.error).length;
  const sourcesFailed = sources.filter((s) => s.error).length;

  console.log(
    `[Agent Scout] Fetched: ${sourcesFetched} success, ${sourcesFailed} failed in ${Date.now() - startTime}ms`,
  );

  // 2. Check if we have any content
  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);
  if (totalItems === 0) {
    console.error(
      "[Agent Scout] No content fetched from any source. Skipping email.",
    );
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["No content fetched from any source"],
    };
  }

  // 3. Synthesize with Ollama (GLM-5.1 Cloud)
  console.log("[Agent Scout] Synthesizing with Ollama...");
  const vpsUrl = process.env.VPS_URL;
  if (!vpsUrl) {
    console.error("[Agent Scout] Missing VPS_URL");
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["Missing VPS_URL"],
    };
  }

  let htmlContent: string;
  try {
    htmlContent = await synthesize(sources, vpsUrl, SYSTEM_PROMPT, process.env.API_KEY);
  } catch (err) {
    console.error("[Agent Scout] Ollama synthesis failed:", err);
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: [
        `Ollama synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  // 4. Build and send email
  console.log("[Agent Scout] Sending email via Resend...");
  const now = new Date();
  const subject = makeEmailSubject(now, SCOUT_BRANDING);
  const emailHtml = buildEmailHtml(htmlContent, now, SCOUT_BRANDING);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
  const resendTo = process.env.RESEND_TO;

  if (!resendApiKey || !resendTo) {
    console.error("[Agent Scout] Missing RESEND_API_KEY or RESEND_TO");
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["Missing Resend configuration"],
    };
  }

  const emailResult = await sendEmail({
    htmlContent: emailHtml,
    subject,
    from: resendFrom,
    to: resendTo,
    apiKey: resendApiKey,
  });

  const elapsed = Date.now() - startTime;
  console.log(`[Agent Scout] Run completed in ${elapsed}ms`);

  const result: ScoutResult = {
    success: emailResult.success,
    sourcesFetched,
    sourcesFailed,
    emailSent: emailResult.success,
    errors: [
      ...sources.filter((s) => s.error).map((s) => `${s.source}: ${s.error}`),
      ...(emailResult.error ? [`Resend: ${emailResult.error}`] : []),
    ],
  };

  return result;
}

// Run directly when executed as main script
if (
  process.argv[1]?.endsWith("scout.ts") ||
  process.argv[1]?.endsWith("scout.js")
) {
  runScout()
    .then((result) => {
      console.log("[Agent Scout] Result:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[Agent Scout] Fatal error:", err);
      process.exit(1);
    });
}
