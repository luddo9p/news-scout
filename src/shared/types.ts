// src/shared/types.ts

/** Result from a single data source */
export interface SourceResult {
  source: string;
  items: ContentItem[];
  error?: string;
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
  systemPrompt: string;
  emailBranding: EmailBranding;
}