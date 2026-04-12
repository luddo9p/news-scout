// src/types.ts

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
  summary: string;
  source: string;
  author?: string;
  date?: string;
  score?: number;
}

/** Full result of the scout run */
export interface ScoutResult {
  success: boolean;
  sourcesFetched: number;
  sourcesFailed: number;
  emailSent: boolean;
  errors: string[];
}
