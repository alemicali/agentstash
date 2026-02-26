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
  id: "openclaw",
  displayName: "OpenClaw",
  description: "OpenClaw AI coding agent with workspace, sessions, memory, and skills",
  dataDirs: [
    { path: "~/.openclaw", description: "OpenClaw data directory", critical: true },
  ],
  categories: {
    config: {
      description: "Main configuration files (openclaw.json, .env)",
      backupIncludes: ["openclaw.json", "openclaw.json5", ".env"],
      restoreIncludes: ["**/openclaw.json", "**/openclaw.json5", "**/.env"],
    },
    secrets: {
      description: "Credentials and auth tokens",
      backupIncludes: ["credentials/**", "auth/**"],
      restoreIncludes: ["**/credentials/**", "**/auth/**"],
    },
    workspace: {
      description: "Workspace prompts, identity, memory logs, canvas",
      backupIncludes: ["workspace/**", "workspace-*/**"],
      restoreIncludes: ["**/workspace/**", "**/workspace-*/**"],
    },
    sessions: {
      description: "Agent session transcripts",
      backupIncludes: ["agents/*/sessions/**"],
      restoreIncludes: ["**/agents/*/sessions/**"],
    },
    memory: {
      description: "Persistent memory databases",
      backupIncludes: ["memory/**"],
      restoreIncludes: ["**/memory/**"],
    },
    skills: {
      description: "Managed and local skills",
      backupIncludes: ["skills/**", "workspace/skills/**"],
      restoreIncludes: ["**/skills/**", "**/workspace/skills/**"],
    },
    settings: {
      description: "User preferences (TTS, UI state)",
      backupIncludes: ["settings/**"],
      restoreIncludes: ["**/settings/**"],
    },
    history: {
      description: "Per-agent configuration and history",
      backupIncludes: ["agents/*/agent/**"],
      restoreIncludes: ["**/agents/*/agent/**"],
    },
  },
  excludes: [
    "*.lock",
    "gateway.lock",
    "*.tmp",
    "*.temp",
    "*-wal",
    "*-shm",
    "node_modules",
    ".DS_Store",
    "Thumbs.db",
    "*.log",
    "cache/",
    ".cache/",
    "sandboxes/",
    "*/qmd/xdg-cache/",
  ],
  detectInstalled(): boolean {
    return existsSync(join(homedir(), ".openclaw"));
  },
  async isRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch("http://127.0.0.1:18789/health", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return checkProcessRunning("openclaw");
    }
  },
};

registerAgent(definition);
