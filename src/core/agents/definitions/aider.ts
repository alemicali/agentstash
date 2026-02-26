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

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd} 2>/dev/null`, { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

const definition: AgentDefinition = {
  id: "aider",
  displayName: "Aider",
  description: "Aider AI pair programming tool with config and history dotfiles",
  dataDirs: [
    { path: "~", description: "Aider stores config in home dir dotfiles", critical: false },
  ],
  categories: {
    config: {
      description: "Main configuration file",
      backupIncludes: [".aider.conf.yml"],
      restoreIncludes: ["**/.aider.conf.yml"],
    },
    history: {
      description: "Input and chat history",
      backupIncludes: [".aider.input.history", ".aider.chat.history.md"],
      restoreIncludes: ["**/.aider.input.history", "**/.aider.chat.history.md"],
    },
    settings: {
      description: "Model settings and metadata",
      backupIncludes: [".aider.model.settings.yml", ".aider.model.metadata.json"],
      restoreIncludes: ["**/.aider.model.settings.yml", "**/.aider.model.metadata.json"],
    },
  },
  excludes: [],
  detectInstalled(): boolean {
    const home = homedir();
    return (
      commandExists("aider") ||
      existsSync(join(home, ".aider.conf.yml")) ||
      existsSync(join(home, ".aider.input.history"))
    );
  },
  async isRunning(): Promise<boolean> {
    return checkProcessRunning("aider");
  },
};

registerAgent(definition);
