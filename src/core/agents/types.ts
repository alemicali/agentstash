import type { FileCategory } from "./categories.js";

export interface AgentDefinition {
  /** Unique identifier (e.g., "openclaw", "claude-code") */
  id: string;
  /** Display name (e.g., "OpenClaw", "Claude Code") */
  displayName: string;
  /** Short description */
  description: string;
  /** Primary data directories to back up (use ~ for home dir) */
  dataDirs: DataDir[];
  /** File categories for selective backup/restore with --only */
  categories: Record<string, CategoryRule>;
  /** Glob patterns to exclude from backup */
  excludes: string[];
  /** Check if this agent is installed on the system */
  detectInstalled(): boolean;
  /** Optional: check if the agent process is currently running (for SQLite lock warnings) */
  isRunning?(): Promise<boolean>;
  /** Optional: estimate data size */
  estimateSize?(): Promise<number>;
}

export interface DataDir {
  /** Path (supports ~ for home) */
  path: string;
  /** Description of what this directory contains */
  description: string;
  /** Whether this is a critical directory (credentials, config) vs optional (cache, logs) */
  critical: boolean;
}

export interface CategoryRule {
  /** Human-readable description */
  description: string;
  /** Glob include patterns for backup (relative to agent data dir) */
  backupIncludes: string[];
  /** Glob include patterns for restore (with ** prefix for restic) */
  restoreIncludes: string[];
}
