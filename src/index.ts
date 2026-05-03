import { TECH_AI_CONFIG } from "./agents/tech-ai.js";
import { LUXE_DIGITAL_CONFIG } from "./agents/luxe-digital.js";
import { SCHANG_CONFIG, HIGGONS_CONFIG, MAUGEY_CONFIG, DUNAND_CONFIG } from "./agents/bourse-scout.js";
import { runAgent } from "./shared/run-agent.js";
import { runBourseScout } from "./bourse/run-bourse.js";

const STANDARD_AGENTS: Record<string, typeof TECH_AI_CONFIG> = {
  "tech-ai": TECH_AI_CONFIG,
  "luxe-digital": LUXE_DIGITAL_CONFIG,
};

const BOURSE_AGENTS: Record<string, typeof SCHANG_CONFIG> = {
  "bourse-scout": SCHANG_CONFIG,
  "higgons-scout": HIGGONS_CONFIG,
  "maugey-scout": MAUGEY_CONFIG,
  "dunand-scout": DUNAND_CONFIG,
};

const agentName = process.argv[2]?.replace(/^--agent=/, "") || "tech-ai";

if (BOURSE_AGENTS[agentName]) {
  const config = BOURSE_AGENTS[agentName];
  runBourseScout(config)
    .then((result) => {
      console.log(`[${config.branding.title}] Result:`, JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error(`[${config.branding.title}] Fatal error:`, err);
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
    `Unknown agent: "${agentName}". Available: ${[...Object.keys(STANDARD_AGENTS), ...Object.keys(BOURSE_AGENTS)].join(", ")}`,
  );
  process.exit(1);
}