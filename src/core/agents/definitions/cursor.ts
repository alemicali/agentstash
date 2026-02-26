import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { registerAgent } from "../registry.js";
import type { AgentDefinition } from "../types.js";

const definition: AgentDefinition = {
  id: "cursor",
  displayName: "Cursor",
  description: "Cursor AI-powered code editor settings and extensions",
  dataDirs: [
    { path: "~/.cursor", description: "Cursor extensions and config", critical: true },
    { path: "~/.config/Cursor", description: "Cursor app data (Linux)", critical: true },
  ],
  categories: {
    config: {
      description: "Editor configuration and keybindings",
      backupIncludes: ["User/settings.json", "User/keybindings.json"],
      restoreIncludes: ["**/User/settings.json", "**/User/keybindings.json"],
    },
    settings: {
      description: "User preferences",
      backupIncludes: ["User/settings.json", "User/keybindings.json"],
      restoreIncludes: ["**/User/settings.json", "**/User/keybindings.json"],
    },
  },
  excludes: [
    "extensions/**",
    "CachedData/**",
    "Cache/**",
    "logs/**",
    "node_modules/**",
  ],
  detectInstalled(): boolean {
    const home = homedir();
    return (
      existsSync(join(home, ".cursor")) ||
      existsSync(join(home, ".config", "Cursor"))
    );
  },
};

registerAgent(definition);
