import { getAgentstashConfigPath } from "../utils/platform.js";
import { readJson, writeJson } from "../utils/fs.js";

export interface StorageConfig {
  provider: "r2" | "s3" | "b2" | "minio";
  bucket: string;
  /** Cloudflare account ID (R2 only) */
  accountId?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Custom S3 endpoint (auto-generated for R2) */
  endpoint?: string;
  /** AWS region (S3 only, default us-east-1) */
  region?: string;
  /** R2 jurisdiction hint (e.g. "eu"). Used to build endpoint if no custom endpoint is set. */
  jurisdiction?: string;
}

export interface RetentionConfig {
  keepLast: number;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
}

export interface DaemonConfig {
  enabled: boolean;
  intervalMinutes: number;
  /** Wait for N minutes of inactivity before backup */
  quietMinutes: number;
}

export interface AgentConfig {
  /** Agent identifier (matches registry id) */
  id: string;
  /** Override data directory (optional, uses agent default if not set) */
  dataDir?: string;
  /** Whether backup is enabled for this agent */
  enabled: boolean;
  /** Additional exclude patterns specific to this agent */
  excludes?: string[];
}

export interface AgentstashConfig {
  version: 1;
  agents: AgentConfig[];
  storage: StorageConfig;
  retention: RetentionConfig;
  daemon: DaemonConfig;
  /** Additional exclude patterns for restic */
  exclude: string[];
  /** Restic version to use */
  resticVersion: string;
}

/** Legacy config shape for backward compatibility migration */
interface LegacyConfig extends Omit<AgentstashConfig, "agents"> {
  openclawDir?: string;
  agents?: AgentConfig[];
}

export const DEFAULT_RETENTION: RetentionConfig = {
  keepLast: 7,
  keepDaily: 30,
  keepWeekly: 12,
  keepMonthly: 6,
};

export const DEFAULT_DAEMON: DaemonConfig = {
  enabled: false,
  intervalMinutes: 60,
  quietMinutes: 5,
};

export const CURRENT_RESTIC_VERSION = "0.17.3";

/**
 * Build the S3 endpoint URL for a storage config.
 */
export function getStorageEndpoint(storage: StorageConfig): string {
  if (storage.endpoint) return storage.endpoint;

  switch (storage.provider) {
    case "r2": {
      if (!storage.accountId) {
        throw new Error("R2 requires an accountId");
      }
      const jur = storage.jurisdiction ? `.${storage.jurisdiction}` : "";
      return `https://${storage.accountId}${jur}.r2.cloudflarestorage.com`;
    }
    case "s3":
      return `https://s3.${storage.region ?? "us-east-1"}.amazonaws.com`;
    case "b2":
      return "https://s3.us-west-004.backblazeb2.com";
    case "minio":
      throw new Error("MinIO requires a custom endpoint");
  }
}

/**
 * Build the restic repository URL for a storage config.
 * Format: s3:https://endpoint/bucket
 */
export function getResticRepoUrl(storage: StorageConfig): string {
  const endpoint = getStorageEndpoint(storage);
  return `s3:${endpoint}/${storage.bucket}`;
}

/**
 * Load config from disk. Returns null if no config exists.
 * Handles backward-compatible migration from openclawDir to agents[].
 */
export async function loadConfig(): Promise<AgentstashConfig | null> {
  const configPath = getAgentstashConfigPath();
  const raw = await readJson<LegacyConfig>(configPath);
  if (!raw) return null;

  // Migrate legacy openclawDir → agents[]
  if (raw.openclawDir && !raw.agents) {
    raw.agents = [{ id: "openclaw", dataDir: raw.openclawDir, enabled: true }];
    delete raw.openclawDir;
  }

  // Ensure agents array exists even if config was written without it
  if (!raw.agents) {
    raw.agents = [];
  }

  return raw as AgentstashConfig;
}

/**
 * Save config to disk.
 */
export async function saveConfig(config: AgentstashConfig): Promise<void> {
  const configPath = getAgentstashConfigPath();
  await writeJson(configPath, config);
}

/**
 * Load config or throw with a helpful message.
 */
export async function requireConfig(): Promise<AgentstashConfig> {
  const config = await loadConfig();
  if (!config) {
    throw new Error(
      "No agentstash config found. Run `agentstash setup` first.",
    );
  }
  return config;
}
