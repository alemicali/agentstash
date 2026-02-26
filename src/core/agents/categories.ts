/** Standard categories across all agents */
export type FileCategory =
  | "config" // Main configuration files
  | "secrets" // Credentials, API keys, auth tokens
  | "sessions" // Conversation history, chat logs
  | "memory" // Persistent memory, knowledge bases
  | "skills" // Custom skills, plugins, extensions
  | "workspace" // Workspace/project-specific data
  | "settings" // User preferences, UI state
  | "history" // Input/prompt history
  | "all"; // Everything (default)

export const CATEGORY_DESCRIPTIONS: Record<FileCategory, string> = {
  config: "Main configuration files",
  secrets: "Credentials, API keys, auth tokens",
  sessions: "Conversation history and chat logs",
  memory: "Persistent memory and knowledge bases",
  skills: "Custom skills, plugins, and extensions",
  workspace: "Workspace and project-specific data",
  settings: "User preferences and UI state",
  history: "Input and prompt history",
  all: "Everything",
};
