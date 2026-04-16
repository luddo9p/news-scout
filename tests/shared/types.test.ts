import { describe, it, expect } from "vitest";
import type { AgentConfig } from "../../src/shared/types.js";

describe("AgentConfig type", () => {
  it("should accept a valid tech-ai config shape", () => {
    const config: AgentConfig = {
      name: "tech-ai",
      sources: [],
      systemPrompt: "Tu es Agent Scout...",
      emailBranding: {
        title: "Agent Scout",
        subjectPrefix: "Agent Scout",
        footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
      },
    };
    expect(config.name).toBe("tech-ai");
    expect(config.emailBranding.title).toBe("Agent Scout");
  });
});