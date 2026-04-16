import { describe, it, expect } from "vitest";
import { TECH_AI_CONFIG } from "../../src/agents/tech-ai.js";

describe("TECH_AI_CONFIG", () => {
  it("should have the correct agent name", () => {
    expect(TECH_AI_CONFIG.name).toBe("tech-ai");
  });

  it("should define 4 source fetchers", () => {
    expect(TECH_AI_CONFIG.sources).toHaveLength(4);
  });

  it("should have systemPrompt with AI/tech sections", () => {
    expect(TECH_AI_CONFIG.systemPrompt).toContain("À lire absolument");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("Nouveaux Outils");
    expect(TECH_AI_CONFIG.systemPrompt).toContain("Tendances");
  });

  it("should have emailBranding for Agent Scout", () => {
    expect(TECH_AI_CONFIG.emailBranding.title).toBe("Agent Scout");
    expect(TECH_AI_CONFIG.emailBranding.subjectPrefix).toBe("Agent Scout");
  });
});