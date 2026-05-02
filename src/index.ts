import { TECH_AI_CONFIG } from "./agents/tech-ai.js";
import { LUXE_DIGITAL_CONFIG } from "./agents/luxe-digital.js";
import { runAgent } from "./shared/run-agent.js";
import { runBourseScout } from "./bourse/run-bourse.js";

const STANDARD_AGENTS: Record<string, typeof TECH_AI_CONFIG> = {
  "tech-ai": TECH_AI_CONFIG,
  "luxe-digital": LUXE_DIGITAL_CONFIG,
};

const agentName = process.argv[2]?.replace(/^--agent=/, "") || "tech-ai";

if (agentName === "bourse-scout") {
  runBourseScout()
    .then((result) => {
      console.log("[Bourse Scout] Result:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("[Bourse Scout] Fatal error:", err);
      process.exit(1);
    });
} else if (STANDARD_AGENTS[agentName]) {
  const config = STANDARD_AGENTS[agentName];

  runAgent(config)
    .then((result) => {
      console.log(
        `[${config.emailBranding.title}] Result:`,
        JSON.stringify(result, null, 2),
      );
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(`[${config.emailBranding.title}] Fatal error:`, err);
      process.exit(1);
    });
} else {
  console.error(
    `Unknown agent: "${agentName}". Available: ${[...Object.keys(STANDARD_AGENTS), "bourse-scout"].join(", ")}`,
  );
  process.exit(1);
}