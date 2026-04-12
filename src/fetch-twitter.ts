// src/fetch-twitter.ts
import type { SourceResult } from "./types.js";

/**
 * Placeholder for X/Twitter source via Apify.
 * To activate, set APIFY_API_KEY in .env and replace this
 * function with a real Apify Actor call.
 */
export async function fetchTwitter(): Promise<SourceResult> {
  return {
    source: "X/Twitter",
    items: [],
    error:
      "Pas encore configuré. Définissez APIFY_API_KEY et remplacez fetchTwitter() par un appel Apify Actor.",
  };
}
