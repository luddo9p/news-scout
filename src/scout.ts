import { fetchBluesky } from "./fetch-bluesky.js";
import { fetchHackerNews } from "./fetch-hackernews.js";
import { fetchReddit } from "./fetch-reddit.js";
import { fetchTwitter } from "./fetch-twitter.js";
import { synthesize } from "./synthesize.js";
import { buildEmailHtml, sendEmail, EMAIL_SUBJECT } from "./send-email.js";
import type { ScoutResult, SourceResult } from "./types.js";

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
    htmlContent = await synthesize(sources, vpsUrl, process.env.API_KEY);
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
  const subject = EMAIL_SUBJECT(now);
  const emailHtml = buildEmailHtml(htmlContent, now);

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
