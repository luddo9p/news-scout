import { describe, it, expect } from "vitest";
import { LUXE_DIGITAL_CONFIG } from "../../src/agents/luxe-digital.js";

describe("LUXE_DIGITAL_CONFIG", () => {
  it("should have the correct agent name", () => {
    expect(LUXE_DIGITAL_CONFIG.name).toBe("luxe-digital");
  });

  it("should define 3 source fetchers", () => {
    expect(LUXE_DIGITAL_CONFIG.sources).toHaveLength(3);
  });

  it("should have systemPrompt with luxury-digital sections", () => {
    expect(LUXE_DIGITAL_CONFIG.systemPrompt).toContain("Activations Digitales");
    expect(LUXE_DIGITAL_CONFIG.systemPrompt).toContain("Innovations Luxe");
    expect(LUXE_DIGITAL_CONFIG.systemPrompt).toContain("Tendances");
  });

  it("should have emailBranding for Luxe Digital Scout", () => {
    expect(LUXE_DIGITAL_CONFIG.emailBranding.title).toBe("Luxe Digital Scout");
    expect(LUXE_DIGITAL_CONFIG.emailBranding.subjectPrefix).toBe("Luxe Digital");
  });
});