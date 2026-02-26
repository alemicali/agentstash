// Public API — for programmatic usage
export type {
  AgentstashConfig,
  AgentConfig,
  StorageConfig,
  RetentionConfig,
  DaemonConfig,
} from "./core/config.js";

export {
  loadConfig,
  saveConfig,
  requireConfig,
  getResticRepoUrl,
  getStorageEndpoint,
} from "./core/config.js";

export {
  scanOpenClawDir,
  isOpenClawRunning,
  categorizeFile,
  type OpenClawScanResult,
  type OpenClawFile,
  type FileCategory,
} from "./core/openclaw.js";

export {
  registerAgent,
  getAgent,
  getAllAgents,
  getInstalledAgents,
  getAgentIds,
} from "./core/agents/registry.js";

export type {
  AgentDefinition,
  DataDir,
  CategoryRule,
} from "./core/agents/types.js";

export { CATEGORY_DESCRIPTIONS } from "./core/agents/categories.js";
export type { FileCategory as AgentFileCategory } from "./core/agents/categories.js";

export {
  backup,
  restore,
  listSnapshots,
  forget,
  stats,
  check,
  initRepo,
  checkRepo,
  type ResticSnapshot,
  type ResticBackupSummary,
  type ResticStats,
} from "./core/restic.js";

export {
  ensureRestic,
  isResticInstalled,
  getResticVersion,
} from "./core/restic-installer.js";

export { runHealthChecks, type HealthCheck } from "./core/health.js";

export {
  ensureBucket,
  createBucket,
  bucketExists,
  testEndpoint,
  detectR2Jurisdiction,
} from "./core/s3.js";

export {
  getPassphrase as getKeychainPassphrase,
  setPassphrase as setKeychainPassphrase,
  deletePassphrase as deleteKeychainPassphrase,
  isKeychainAvailable,
} from "./core/keychain.js";
