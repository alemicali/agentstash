export * from "./types.js";
export * from "./categories.js";
export * from "./registry.js";

// Import agent definitions to trigger registration
import "./definitions/openclaw.js";
import "./definitions/claude-code.js";
import "./definitions/opencode.js";
import "./definitions/gemini.js";
import "./definitions/codex.js";
import "./definitions/aider.js";
import "./definitions/continue-dev.js";
import "./definitions/cursor.js";
import "./definitions/copilot.js";
