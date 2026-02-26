import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerAgent } from "../registry.js";
import type { AgentDefinition } from "../types.js";

const definition: AgentDefinition = {
  id: "continue",
  displayName: "Continue",
  description: "Continue VS Code/JetBrains extension for AI-assisted development",
  dataDirs: [
    { path: "~/.continue", description: "Continue extension data", critical: true },
  ],
  categories: {
    config: {
      description: "Configuration files",
      backupIncludes: ["config.yaml", "config.json"],
      restoreIncludes: ["**/config.yaml", "**/config.json"],
    },
    sessions: {
      description: "Conversation sessions",
      backupIncludes: ["sessions/**"],
      restoreIncludes: ["**/sessions/**"],
    },
    settings: {
      description: "User preferences",
      backupIncludes: ["config.yaml", "config.json"],
      restoreIncludes: ["**/config.yaml", "**/config.json"],
    },
  },
  excludes: [
    "index/**",
    "logs/**",
    "types/**",
    "node_modules/**",
  ],
  detectInstalled(): boolean {
    return existsSync(join(homedir(), ".continue"));
  },
};

registerAgent(definition);
