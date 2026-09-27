const DEFAULT_AGENT = "tech-ai";

/**
 * Reads the last --agent flag from the process arguments.
 *
 * The npm scripts already bake in `--agent=tech-ai`, so a caller's flag arrives
 * after it (`npm start -- --agent=bourse-scout`). Last one wins, otherwise the
 * caller would always get tech-ai. Both `--agent=x` and `--agent x` are accepted.
 */
export function parseAgentName(argv: string[]): string {
  let name = "";
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--agent=")) {
      name = arg.slice("--agent=".length);
    } else if (arg === "--agent" && argv[i + 1]) {
      name = argv[i + 1];
      i++;
    }
  }
  return name || DEFAULT_AGENT;
}
