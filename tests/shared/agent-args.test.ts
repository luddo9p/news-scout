import { describe, it, expect } from "vitest";
import { parseAgentName } from "../../src/shared/agent-args.js";

describe("parseAgentName", () => {
  it("should default to tech-ai when no flag is given", () => {
    expect(parseAgentName(["node", "src/index.ts"])).toBe("tech-ai");
  });

  it("should read the --agent=name form", () => {
    expect(parseAgentName(["node", "src/index.ts", "--agent=luxe-digital"])).toBe(
      "luxe-digital",
    );
  });

  it("should read the --agent name form", () => {
    expect(
      parseAgentName(["node", "src/index.ts", "--agent", "bourse-scout"]),
    ).toBe("bourse-scout");
  });

  it("should let the caller flag override the default baked into the npm script", () => {
    // `npm start` runs `... --agent=tech-ai`, and npm appends the caller's args.
    expect(
      parseAgentName([
        "node",
        "src/index.ts",
        "--agent=tech-ai",
        "--agent=bourse-scout",
      ]),
    ).toBe("bourse-scout");
  });

  it("should ignore a trailing --agent without a value", () => {
    expect(parseAgentName(["node", "src/index.ts", "--agent"])).toBe("tech-ai");
  });

  it("should ignore an empty value and fall back to the default", () => {
    expect(parseAgentName(["node", "src/index.ts", "--agent="])).toBe("tech-ai");
  });
});
