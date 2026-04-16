import { TECH_AI_CONFIG } from "./agents/tech-ai.js";
import { LUXE_DIGITAL_CONFIG } from "./agents/luxe-digital.js";
import { runAgent } from "./shared/run-agent.js";

const AGENTS: Record<string, typeof TECH_AI_CONFIG> = {
  "tech-ai": TECH_AI_CONFIG,
  "luxe-digital": LUXE_DIGITAL_CONFIG,
};

const agentName = process.argv[2]?.replace(/^--agent=/, "") || "tech-ai";

if (!AGENTS[agentName]) {
  console.error(
    `Unknown agent: "${agentName}". Available: ${Object.keys(AGENTS).join(", ")}`,
  );
  process.exit(1);
}

const config = AGENTS[agentName];

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