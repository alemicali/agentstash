import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerAgent } from "../registry.js";
import type { AgentDefinition } from "../types.js";

const definition: AgentDefinition = {
  id: "copilot",
  displayName: "GitHub Copilot",
  description: "GitHub Copilot CLI configuration and host settings",
  dataDirs: [
    { path: "~/.config/github-copilot", description: "GitHub Copilot config", critical: true },
  ],
  categories: {
    config: {
      description: "Host configuration and version info",
      backupIncludes: ["hosts.json", "versions.json"],
      restoreIncludes: ["**/hosts.json", "**/versions.json"],
    },
    settings: {
      description: "Host settings",
      backupIncludes: ["hosts.json"],
      restoreIncludes: ["**/hosts.json"],
    },
  },
  excludes: [
    "node_modules/**",
  ],
  detectInstalled(): boolean {
    return existsSync(join(homedir(), ".config", "github-copilot"));
  },
};

registerAgent(definition);
