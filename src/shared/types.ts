// src/shared/types.ts

/** Result from a single data source */
export interface SourceResult {
  source: string;
  items: ContentItem[];
  error?: string;
  /**
   * Non-fatal problems, e.g. one feed of many that failed. `items` still holds
   * whatever the healthy feeds returned, so a degraded source stays usable and
   * visible instead of looking like an empty one.
   */
  warnings?: string[];
}

/** A single piece of content from any source */
export interface ContentItem {
  title: string;
  url: string;
  context: string;
  source: string;
  author?: string;
  date?: string;
  score?: number;
  tags?: string[];
  highlights?: string[];
  /**
   * Brand site or microsite behind the operation described by `url`, resolved by a
   * web search. The press never links to the experience itself, so this is the only
   * way an article can hand over the address of the experience to visit.
   */
  experienceUrl?: string;
}

/** Full result of the scout run */
export interface ScoutResult {
  success: boolean;
  sourcesFetched: number;
  sourcesFailed: number;
  emailSent: boolean;
  errors: string[];
}

/** Email branding configuration per agent */
export interface EmailBranding {
  title: string;
  subjectPrefix: string;
  footerSources: string;
}

/** Agent configuration — defines sources, prompts, and branding */
export interface AgentConfig {
  name: string;
  sources: (() => Promise<SourceResult>)[];
  /**
   * Optional post-fetch enrichment, e.g. resolving the experience URL behind a news
   * item. It runs after every source settled and must never abort the run.
   */
  enrich?: (sources: SourceResult[]) => Promise<SourceResult[]>;
  systemPrompt: string;
  emailBranding: EmailBranding;
}