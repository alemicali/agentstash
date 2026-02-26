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
  id: "opencode",
  displayName: "OpenCode",
  description: "OpenCode TUI coding agent with sessions DB, snapshots, and state",
  dataDirs: [
    { path: "~/.local/share/opencode", description: "OpenCode data (sessions DB, snapshots)", critical: true },
    { path: "~/.local/state/opencode", description: "OpenCode state (UI prefs, model selection)", critical: false },
    { path: "~/.config/opencode", description: "OpenCode config and plugins", critical: false },
  ],
  categories: {
    config: {
      description: "Main configuration file",
      backupIncludes: ["~/.opencode.json"],
      restoreIncludes: ["**/.opencode.json"],
    },
    secrets: {
      description: "Authentication tokens",
      backupIncludes: ["auth.json"],
      restoreIncludes: ["**/auth.json"],
    },
    sessions: {
      description: "Sessions database and diff storage",
      backupIncludes: ["opencode.db", "storage/session_diff/**"],
      restoreIncludes: ["**/opencode.db", "**/storage/session_diff/**"],
    },
    settings: {
      description: "UI preferences and model selection",
      backupIncludes: ["kv.json", "model.json"],
      restoreIncludes: ["**/kv.json", "**/model.json"],
    },
    history: {
      description: "Prompt input history",
      backupIncludes: ["prompt-history.jsonl"],
      restoreIncludes: ["**/prompt-history.jsonl"],
    },
    workspace: {
      description: "Session snapshots",
      backupIncludes: ["snapshot/**"],
      restoreIncludes: ["**/snapshot/**"],
    },
  },
  excludes: [
    "*-wal",
    "*-shm",
    "*.log",
    "log/**",
    "tool-output/**",
    "bin/**",
    "node_modules/**",
  ],
  detectInstalled(): boolean {
    const home = homedir();
    return (
      existsSync(join(home, ".local", "share", "opencode")) ||
      existsSync(join(home, ".opencode", "bin", "opencode"))
    );
  },
  async isRunning(): Promise<boolean> {
    return checkProcessRunning("opencode");
  },
};

registerAgent(definition);
