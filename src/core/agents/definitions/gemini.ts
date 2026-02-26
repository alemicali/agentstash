import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerAgent } from "../registry.js";
import type { AgentDefinition } from "../types.js";

function checkProcessRunning(name: string): boolean {
  try {
    const output = execSync(`pgrep -f "${name}" 2>/dev/null`, { encoding: "utf-8" });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

const definition: AgentDefinition = {
  id: "gemini",
  displayName: "Gemini CLI",
  description: "Google Gemini CLI with sessions, settings, and project memory",
  dataDirs: [
    { path: "~/.gemini", description: "Gemini CLI data directory", critical: true },
  ],
  categories: {
    config: {
      description: "Main configuration",
      backupIncludes: ["settings.json"],
      restoreIncludes: ["**/settings.json"],
    },
    secrets: {
      description: "Environment secrets and OAuth tokens",
      backupIncludes: [".env", "mcp-oauth-tokens.json"],
      restoreIncludes: ["**/.env", "**/mcp-oauth-tokens.json"],
    },
    sessions: {
      description: "Conversation history and checkpoints",
      backupIncludes: ["history/**", "tmp/**/checkpoints/**"],
      restoreIncludes: ["**/history/**", "**/tmp/**/checkpoints/**"],
    },
    settings: {
      description: "User preferences and trusted folders",
      backupIncludes: ["settings.json", "trustedFolders.json", "mcp-server-enablement.json"],
      restoreIncludes: ["**/settings.json", "**/trustedFolders.json", "**/mcp-server-enablement.json"],
    },
    history: {
      description: "Shell command history",
      backupIncludes: ["tmp/**/shell_history"],
      restoreIncludes: ["**/tmp/**/shell_history"],
    },
    memory: {
      description: "Project memory file",
      backupIncludes: ["GEMINI.md"],
      restoreIncludes: ["**/GEMINI.md"],
    },
  },
  excludes: [
    "tmp/**/otel/**",
    "node_modules/**",
  ],
  detectInstalled(): boolean {
    return existsSync(join(homedir(), ".gemini"));
  },
  async isRunning(): Promise<boolean> {
    return checkProcessRunning("gemini");
  },
};

registerAgent(definition);
