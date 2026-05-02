import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadState, saveState } from "../../src/bourse/persistence.js";
import type { PortfolioState } from "../../src/bourse/types.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "bourse-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const sampleState: PortfolioState = {
  lastUpdated: "2026-05-02T10:00:00.000Z",
  suivi: {
    year: 2026,
    label: "Suivi 2026",
    isCurrent: true,
    performance: "8.50%",
    assets: [
      {
        ticker: "EPA:CA",
        nom: "Carrefour",
        dateAchat: "2026-01-02",
        coursAchat: 14.44,
        dateVente: "",
        coursVente: 16.66,
        plusMinusValue: "15.37%",
      },
    ],
  },
};

describe("persistence", () => {
  it("should return null when file does not exist", async () => {
    const result = await loadState(join(tempDir, "nonexistent.json"));
    expect(result).toBeNull();
  });

  it("should return null for invalid JSON", async () => {
    const { writeFile } = await import("node:fs/promises");
    const filePath = join(tempDir, "state.json");
    await writeFile(filePath, "not json", "utf-8");
    const result = await loadState(filePath);
    expect(result).toBeNull();
  });

  it("should save and load state correctly", async () => {
    const filePath = join(tempDir, "state.json");
    await saveState(sampleState, filePath);
    const loaded = await loadState(filePath);
    expect(loaded).not.toBeNull();
    expect(loaded!.suivi.year).toBe(2026);
    expect(loaded!.suivi.assets).toHaveLength(1);
    expect(loaded!.suivi.assets[0].ticker).toBe("EPA:CA");
  });

  it("should create directory if it does not exist", async () => {
    const filePath = join(tempDir, "subdir", "state.json");
    await saveState(sampleState, filePath);
    const loaded = await loadState(filePath);
    expect(loaded).not.toBeNull();
  });
});