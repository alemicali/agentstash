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
  id: "claude-code",
  displayName: "Claude Code",
  description: "Anthropic's CLI coding agent with sessions, skills, and project memory",
  dataDirs: [
    { path: "~/.claude", description: "Claude Code data (sessions, settings, skills)", critical: true },
    { path: "~/.claude.json", description: "Claude Code master state file", critical: true },
  ],
  categories: {
    config: {
      description: "Configuration and state files",
      backupIncludes: ["settings.json", "settings.local.json", "mcp-needs-auth-cache.json"],
      restoreIncludes: ["**/settings.json", "**/settings.local.json", "**/mcp-needs-auth-cache.json"],
    },
    secrets: {
      description: "Credentials and auth tokens",
      backupIncludes: [".credentials.json"],
      restoreIncludes: ["**/.credentials.json"],
    },
    sessions: {
      description: "Project conversation sessions and memory",
      backupIncludes: ["projects/**/*.jsonl", "projects/**/memory/**"],
      restoreIncludes: ["**/projects/**/*.jsonl", "**/projects/**/memory/**"],
    },
    skills: {
      description: "Custom agent skills",
      backupIncludes: ["skills/**"],
      restoreIncludes: ["**/skills/**"],
    },
    settings: {
      description: "User preferences and shell configuration",
      backupIncludes: ["settings.json", "settings.local.json", "statusline-command.sh"],
      restoreIncludes: ["**/settings.json", "**/settings.local.json", "**/statusline-command.sh"],
    },
    history: {
      description: "Global command history",
      backupIncludes: ["history.jsonl"],
      restoreIncludes: ["**/history.jsonl"],
    },
    workspace: {
      description: "Plans and todos",
      backupIncludes: ["plans/**", "todos/**"],
      restoreIncludes: ["**/plans/**", "**/todos/**"],
    },
  },
  excludes: [
    "debug/**",
    "file-history/**",
    "cache/**",
    "telemetry/**",
    "shell-snapshots/**",
    "paste-cache/**",
    "session-env/**",
    "tasks/**",
    "downloads/**",
    "backups/**",
    "plugins/marketplaces/*/.git/**",
  ],
  detectInstalled(): boolean {
    const home = homedir();
    return existsSync(join(home, ".claude")) || existsSync(join(home, ".claude.json"));
  },
  async isRunning(): Promise<boolean> {
    return checkProcessRunning("claude");
  },
};

registerAgent(definition);
