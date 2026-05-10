import type { SourceResult, ContentItem } from "../shared/types.js";
import { getSinceTimestamp } from "../shared/date-filter.js";

const LOBSTERS_URL = "https://lobste.rs/hottest.json";
const TIMEOUT_MS = 10000;

interface LobstersStory {
  url?: string;
  title?: string;
  description?: string;
  submitter?: string;
  score?: number;
  created_at?: string;
  tags?: string[];
  comment_count?: number;
}

function storyToContentItem(story: LobstersStory): ContentItem | null {
  if (!story.title) return null;

  return {
    title: story.title,
    url: story.url || "",
    context: story.description || story.title,
    source: "Lobste.rs",
    author: story.submitter,
    date: story.created_at,
    score: story.score,
    tags: story.tags,
  };
}

export async function fetchLobsters(): Promise<SourceResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(LOBSTERS_URL, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AgentScout/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source: "Lobste.rs",
        items: [],
        error: `Lobste.rs API returned ${response.status}`,
      };
    }

    const data: LobstersStory[] = await response.json();

    const { iso } = getSinceTimestamp();
    const seen = new Set<string>();
    const items: ContentItem[] = data
      .map(storyToContentItem)
      .filter((item): item is ContentItem => item !== null && item.url !== "")
      .filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        if (!item.date) return true;
        return new Date(item.date) >= new Date(iso);
      });

    return { source: "Lobste.rs", items };
  } catch (err) {
    return {
      source: "Lobste.rs",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}