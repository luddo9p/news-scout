import { synthesize } from "./synthesize.js";
import { buildEmailHtml, makeEmailSubject, sendEmail } from "./send-email.js";
import type { AgentConfig, ScoutResult, SourceResult } from "./types.js";

/** Source failures and degraded-source notices, prefixed with the source name. */
function collectSourceIssues(sources: SourceResult[]): string[] {
  return [
    ...sources.filter((s) => s.error).map((s) => `${s.source}: ${s.error}`),
    ...sources.flatMap((s) =>
      (s.warnings ?? []).map((warning) => `${s.source}: ${warning}`),
    ),
  ];
}

export async function runAgent(config: AgentConfig): Promise<ScoutResult> {
  console.log(`[${config.emailBranding.title}] Starting run...`);
  const startTime = Date.now();

  // 1. Fetch all sources in parallel
  console.log(`[${config.emailBranding.title}] Fetching sources...`);
  const results = await Promise.allSettled(config.sources.map((fn) => fn()));

  let sources: SourceResult[] = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      source: `Source ${index + 1}`,
      items: [],
      error: result.reason?.message || String(result.reason),
    };
  });

  const sourcesFetched = sources.filter((s) => !s.error).length;
  const sourcesFailed = sources.filter((s) => s.error).length;

  console.log(
    `[${config.emailBranding.title}] Fetched: ${sourcesFetched} success, ${sourcesFailed} failed in ${Date.now() - startTime}ms`,
  );
  for (const s of sources) {
    if (s.error) {
      console.log(`  [${config.emailBranding.title}] ❌ ${s.source}: ${s.error}`);
    } else {
      console.log(`  [${config.emailBranding.title}] ✅ ${s.source}: ${s.items.length} items`);
    }
  }
  for (const s of sources) {
    for (const warning of s.warnings ?? []) {
      console.log(`  [${config.emailBranding.title}] ⚠️ ${s.source}: ${warning}`);
    }
  }

  // 1b. Optional enrichment (e.g. resolving experience URLs). A failure here must
  // never cost the run: the items are simply left as fetched.
  if (config.enrich) {
    try {
      sources = await config.enrich(sources);
    } catch (err) {
      console.error(
        `[${config.emailBranding.title}] Enrichment failed:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // 2. Check if we have any content
  const totalItems = sources.reduce((sum, s) => sum + s.items.length, 0);
  if (totalItems === 0) {
    console.error(
      `[${config.emailBranding.title}] No content fetched from any source. Skipping email.`,
    );
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["No content fetched from any source", ...collectSourceIssues(sources)],
    };
  }

  // 3. Synthesize with Ollama
  console.log(`[${config.emailBranding.title}] Synthesizing with Ollama...`);
  const vpsUrl = process.env.VPS_URL;
  if (!vpsUrl) {
    console.error(`[${config.emailBranding.title}] Missing VPS_URL`);
    return {
      success: false,
      sourcesFetched,
      sourcesFailed,
      emailSent: false,
      errors: ["Missing VPS_URL"],
    };
  }

  let synthesisData;
  try {
    synthesisData = await synthesize(
      sources,
      vpsUrl,
      config.systemPrompt,
      process.env.API_KEY,
    );
  } catch (err) {
    console.error(`[${config.emailBranding.title}] Ollama synthesis failed:`, err);
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
  console.log(`[${config.emailBranding.title}] Sending email via Resend...`);
  const now = new Date();
  const subject = makeEmailSubject(now, config.emailBranding);
  const emailHtml = buildEmailHtml(synthesisData, now, config.emailBranding);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";
  const resendTo = process.env.RESEND_TO;

  if (!resendApiKey || !resendTo) {
    console.error(
      `[${config.emailBranding.title}] Missing RESEND_API_KEY or RESEND_TO`,
    );
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
  console.log(`[${config.emailBranding.title}] Run completed in ${elapsed}ms`);

  return {
    success: emailResult.success,
    sourcesFetched,
    sourcesFailed,
    emailSent: emailResult.success,
    errors: [
      ...collectSourceIssues(sources),
      ...(emailResult.error ? [`Resend: ${emailResult.error}`] : []),
    ],
  };
}