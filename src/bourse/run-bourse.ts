import { fetchAndParsePortfolio } from "./scrape.js";
import { computeDiff } from "./diff.js";
import { loadState, saveState } from "./persistence.js";
import {
  buildBourseChangeEmailHtml,
  buildBourseInitEmailHtml,
  makeBourseSubject,
  makeBourseInitSubject,
} from "./email.js";
import { sendEmail } from "../shared/send-email.js";
import type { PortfolioState, BourseScoutResult } from "./types.js";
import {
  BOURSE_PORTFOLIO_URL,
  BOURSE_BRANDING,
  BOURSE_STATE_PATH,
} from "../agents/bourse-scout.js";

export async function runBourseScout(): Promise<BourseScoutResult> {
  const branding = BOURSE_BRANDING;
  const now = new Date();

  // 1. Scrape current portfolio
  const scrapeResult = await fetchAndParsePortfolio(BOURSE_PORTFOLIO_URL);
  if (scrapeResult.error || !scrapeResult.suivi) {
    return {
      success: false,
      emailSent: false,
      changes: 0,
      errors: [scrapeResult.error ?? "No Suivi table found"],
    };
  }

  const currentSuivi = scrapeResult.suivi;

  // 2. Load previous state
  const previousState = await loadState(BOURSE_STATE_PATH);

  // 3. First run — no previous state
  if (!previousState) {
    const newState: PortfolioState = {
      lastUpdated: now.toISOString(),
      suivi: currentSuivi,
    };

    await saveState(newState, BOURSE_STATE_PATH);

    // Send init email
    const subject = makeBourseInitSubject(branding.subjectPrefix);
    const htmlContent = buildBourseInitEmailHtml(
      currentSuivi,
      now,
      branding.title,
      branding.footerSource,
    );

    const emailResult = await sendEmail({
      htmlContent,
      subject,
      from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
      to: process.env.RESEND_TO!,
      apiKey: process.env.RESEND_API_KEY!,
    });

    if (!emailResult.success) {
      return {
        success: false,
        emailSent: false,
        changes: 0,
        errors: [`Init email failed: ${emailResult.error}`],
      };
    }

    console.log(
      `[${branding.title}] Init email sent (${currentSuivi.assets.length} positions)`,
    );
    return { success: true, emailSent: true, changes: 0, errors: [] };
  }

  // 4. Subsequent runs — compute diff
  const previousSuivi = previousState.suivi;
  const changes = computeDiff(previousSuivi, currentSuivi);

  if (changes.length === 0) {
    // No changes — just save current state and return
    const newState: PortfolioState = {
      lastUpdated: now.toISOString(),
      suivi: currentSuivi,
    };
    await saveState(newState, BOURSE_STATE_PATH);
    console.log(`[${branding.title}] No changes detected`);
    return { success: true, emailSent: false, changes: 0, errors: [] };
  }

  // 5. Changes detected — send email
  const subject = makeBourseSubject(now, changes.length, branding.subjectPrefix);
  const htmlContent = buildBourseChangeEmailHtml(
    changes,
    currentSuivi,
    now,
    branding.title,
    branding.footerSource,
  );

  const emailResult = await sendEmail({
    htmlContent,
    subject,
    from: process.env.RESEND_FROM ?? "onboarding@resend.dev",
    to: process.env.RESEND_TO!,
    apiKey: process.env.RESEND_API_KEY!,
  });

  if (!emailResult.success) {
    // Don't save state — retry next time
    return {
      success: false,
      emailSent: false,
      changes: changes.length,
      errors: [`Email failed: ${emailResult.error}`],
    };
  }

  // 6. Email sent — save state
  const newState: PortfolioState = {
    lastUpdated: now.toISOString(),
    suivi: currentSuivi,
  };
  await saveState(newState, BOURSE_STATE_PATH);

  console.log(
    `[${branding.title}] ${changes.length} change(s) detected, email sent`,
  );
  return { success: true, emailSent: true, changes: changes.length, errors: [] };
}