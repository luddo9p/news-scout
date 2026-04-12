import type { Handler } from "@netlify/functions";
import { fetchBluesky } from "../../src/fetch-bluesky.js";
import { fetchHackerNews } from "../../src/fetch-hackernews.js";
import { fetchTwitter } from "../../src/fetch-twitter.js";
import { synthesize } from "../../src/synthesize.js";
import {
  buildEmailHtml,
  sendEmail,
  EMAIL_SUBJECT,
} from "../../src/send-email.js";
import type { ScoutResult, SourceResult } from "../../src/types.js";

const BLUESKY_HASHTAGS = ["#vibecoding", "#IA"];
const HN_QUERIES = ["AI", "LLM"];

const handler: Handler = async () => {
  console.log("[Agent Scout] Starting scout run...");

  const startTime = Date.now();

  // 1. Fetch all sources in parallel
  console.log("[Agent Scout] Fetching sources...");
  const results = await Promise.allSettled([
    fetchBluesky(BLUESKY_HASHTAGS),
    fetchHackerNews(HN_QUERIES),
    fetchTwitter(),
  ]);

  const sources: SourceResult[] = results.map((result, index) => {
    const sourceNames = ["Bluesky", "Hacker News", "X/Twitter"];
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
    `[Agent Scout] Fetched: ${sourcesFetched} success, ${sourcesFailed} failed`,
  );

  // 2. Check if we have any content
  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);
  if (totalItems === 0) {
    console.error(
      "[Agent Scout] No content fetched from any source. Skipping email.",
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "No content fetched from any source",
        sourcesFetched,
        sourcesFailed,
      }),
    };
  }

  // 3. Synthesize with Groq
  console.log("[Agent Scout] Synthesizing with Groq...");
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.error("[Agent Scout] Missing GROQ_API_KEY");
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: "Missing GROQ_API_KEY" }),
    };
  }

  let htmlContent: string;
  try {
    htmlContent = await synthesize(sources, groqApiKey);
  } catch (err) {
    console.error("[Agent Scout] Groq synthesis failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: `Groq synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      }),
    };
  }

  // 4. Build email
  console.log("[Agent Scout] Building email...");
  const now = new Date();
  const subject = EMAIL_SUBJECT(now);
  const emailHtml = buildEmailHtml(htmlContent, now);

  // 5. Send email via Resend
  console.log("[Agent Scout] Sending email via Resend...");
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
  const resendTo = process.env.RESEND_TO;

  if (!resendApiKey || !resendTo) {
    console.error("[Agent Scout] Missing RESEND_API_KEY or RESEND_TO");
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "Missing Resend configuration",
      }),
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

  return {
    statusCode: emailResult.success ? 200 : 500,
    body: JSON.stringify(result),
  };
};

export { handler };
