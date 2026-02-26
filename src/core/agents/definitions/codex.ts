import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerAgent } from "../registry.js";
import type { AgentDefinition } from "../types.js";

const definition: AgentDefinition = {
  id: "codex",
  displayName: "Codex CLI",
  description: "OpenAI Codex CLI configuration",
  dataDirs: [
    { path: "~/.codex", description: "OpenAI Codex CLI config", critical: true },
  ],
  categories: {
    config: {
      description: "Main configuration file",
      backupIncludes: ["config.toml"],
      restoreIncludes: ["**/config.toml"],
    },
    settings: {
      description: "User preferences",
      backupIncludes: ["config.toml"],
      restoreIncludes: ["**/config.toml"],
    },
  },
  excludes: [
    "*.log",
  ],
  detectInstalled(): boolean {
    return existsSync(join(homedir(), ".codex"));
  },
};

registerAgent(definition);
