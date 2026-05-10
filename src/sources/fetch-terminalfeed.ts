import type { SourceResult, ContentItem } from "../shared/types.js";
import { getSinceTimestamp } from "../shared/date-filter.js";

const GITHUB_API = "https://api.github.com/search/repositories";
const TIMEOUT_MS = 10000;
const PER_PAGE = 15;

interface GitHubRepo {
  full_name?: string;
  html_url?: string;
  description?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  created_at?: string;
}

function repoToContentItem(repo: GitHubRepo): ContentItem | null {
  if (!repo.full_name || !repo.html_url) return null;

  return {
    title: repo.full_name,
    url: repo.html_url,
    context: repo.description || repo.full_name,
    source: "GitHub Trending",
    score: repo.stargazers_count,
    tags: repo.language ? [repo.language] : undefined,
    date: repo.created_at,
  };
}

export async function fetchTerminalFeed(): Promise<SourceResult> {
  try {
    const { date } = getSinceTimestamp();
    // Repos created in the last 24h with 10+ stars, sorted by stars
    const query = `created:>${date} stars:>10`;
    const url = `${GITHUB_API}?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${PER_PAGE}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "AgentScout/1.0",
    };
    const githubToken = process.env.GITHUB_TOKEN;
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        source: "GitHub Trending",
        items: [],
        error: `GitHub API returned ${response.status}`,
      };
    }

    const data = await response.json();
    const repos: GitHubRepo[] = data.items || [];

    const items: ContentItem[] = repos
      .map(repoToContentItem)
      .filter((item): item is ContentItem => item !== null && item.url !== "");

    return { source: "GitHub Trending", items };
  } catch (err) {
    return {
      source: "GitHub Trending",
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}