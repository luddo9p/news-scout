import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { PortfolioState } from "./types.js";

const DEFAULT_STATE_PATH = "data/bourse-scout-state.json";

export async function loadState(
  filePath: string = process.env.BOURSE_STATE_PATH || DEFAULT_STATE_PATH,
): Promise<PortfolioState | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const state = JSON.parse(raw);
    if (!state.suivi || !state.lastUpdated) return null;
    return state as PortfolioState;
  } catch {
    return null;
  }
}

export async function saveState(
  state: PortfolioState,
  filePath: string = process.env.BOURSE_STATE_PATH || DEFAULT_STATE_PATH,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf-8");
}