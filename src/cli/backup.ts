import ora from "ora";
import chalk from "chalk";
import { homedir } from "node:os";
import { log } from "../utils/logger.js";
import { formatBytes, formatDuration, pathExists } from "../utils/fs.js";
import { requireConfig, type AgentConfig } from "../core/config.js";
import { getAgent } from "../core/agents/registry.js";
import { ensureRestic } from "../core/restic-installer.js";
import { backup, forget } from "../core/restic.js";
import { getPassphrase as getKeychainPassphrase } from "../core/keychain.js";

export interface BackupOptions {
  passphrase?: string;
  agent?: string;
  only?: string;
  dryRun?: boolean;
  /** Commander's --no-forget sets this to false (default true) */
  forget?: boolean;
}

async function resolvePassphrase(opts: BackupOptions): Promise<string> {
  // 1. Explicit flag
  if (opts.passphrase) return opts.passphrase;

  // 2. Environment variable
  if (process.env.AGENTSTASH_PASSPHRASE) return process.env.AGENTSTASH_PASSPHRASE;

  // 3. System keychain
  const fromKeychain = await getKeychainPassphrase();
  if (fromKeychain) {
    log.debug("Passphrase loaded from system keychain");
    return fromKeychain;
  }

  // 4. Give up
  log.error("No passphrase found.");
  log.info("Options:");
  log.info("  1. Save to keychain:  agentstash setup");
  log.info("  2. Set env var:       export AGENTSTASH_PASSPHRASE=...");
  log.info("  3. Pass flag:         --passphrase ...");
  process.exit(1);
}

/**
 * Resolve ~ to home directory in a path.
 */
function expandHome(p: string): string {
  if (p.startsWith("~/")) return p.replace("~", homedir());
  if (p === "~") return homedir();
  return p;
}

/**
 * Map --only flag to restic include paths using agent category definitions.
 */
function getCategoryIncludes(agentId: string, only?: string): string[] | undefined {
  if (!only) return undefined;

  const agentDef = getAgent(agentId);
  if (!agentDef) {
    log.error(`Unknown agent: ${agentId}`);
    process.exit(1);
  }

  const categoryRule = agentDef.categories[only];
  if (!categoryRule) {
    const validCategories = Object.keys(agentDef.categories).join(", ");
    log.error(`Unknown category "${only}" for agent ${agentDef.displayName}`);
    log.info(`Valid categories: ${validCategories}`);
    process.exit(1);
  }

  return categoryRule.backupIncludes;
}

/**
 * Backup a single agent's data directories.
 */
async function backupAgent(
  agentConfig: AgentConfig,
  opts: BackupOptions,
  passphrase: string,
  config: Awaited<ReturnType<typeof requireConfig>>,
): Promise<void> {
  const agentDef = getAgent(agentConfig.id);
  if (!agentDef) {
    log.warn(`Agent "${agentConfig.id}" not found in registry, skipping`);
    return;
  }

  log.blank();
  log.header(`Backing up ${agentDef.displayName}`);

  // Check if agent process is running
  if (agentDef.isRunning) {
    const running = await agentDef.isRunning();
    if (running) {
      log.warn(`${agentDef.displayName} is running. SQLite files may be locked.`);
      log.info(chalk.dim("Backup will proceed but SQLite data may be inconsistent."));
      log.blank();
    }
  }

  // Determine data directories to backup
  const dataDirs = agentConfig.dataDir
    ? [{ path: agentConfig.dataDir, description: "Custom data directory", critical: true }]
    : agentDef.dataDirs;

  for (const dataDir of dataDirs) {
    const resolvedDir = expandHome(dataDir.path);

    if (!(await pathExists(resolvedDir))) {
      log.warn(`Data directory not found: ${resolvedDir} (${dataDir.description})`);
      continue;
    }

    // Build excludes: agent defaults + agent-specific config + global config
    const excludes = [
      ...agentDef.excludes,
      ...(agentConfig.excludes ?? []),
      ...config.exclude,
    ];

    // Build tags
    const tags = ["agentstash", agentConfig.id];
    if (opts.only) tags.push(opts.only);

    // Build includes (for --only filtering)
    const includes = getCategoryIncludes(agentConfig.id, opts.only);

    // Run backup
    const spinner = ora(
      opts.dryRun
        ? `Calculating backup for ${resolvedDir} (dry run)...`
        : `Backing up ${resolvedDir}...`,
    ).start();

    try {
      const summary = await backup(resolvedDir, {
        storage: config.storage,
        passphrase,
      }, {
        tags,
        excludes,
        includes,
        dryRun: opts.dryRun,
      });

      spinner.stop();

      const totalFiles = summary.files_new + summary.files_changed + summary.files_unmodified;
      const changedFiles = summary.files_new + summary.files_changed;

      log.blank();
      if (opts.dryRun) {
        log.info(chalk.dim(`[${agentDef.displayName}] Dry run complete`));
      } else {
        log.info(chalk.green(`[${agentDef.displayName}] Backup complete`));
      }

      log.kv("Snapshot", summary.snapshot_id.slice(0, 8), "ok");
      log.kv("Source", resolvedDir);
      log.kv("Files", `${totalFiles} total, ${changedFiles} changed`);
      log.kv("Data added", formatBytes(summary.data_added));
      log.kv("Processed", formatBytes(summary.total_bytes_processed));
      log.kv("Duration", formatDuration(summary.total_duration));
    } catch (err) {
      spinner.fail(`Backup failed for ${resolvedDir}`);
      log.error(String(err));
    }
  }
}

export async function backupCommand(opts: BackupOptions): Promise<void> {
  const config = await requireConfig();
  const passphrase = await resolvePassphrase(opts);

  // Ensure restic
  await ensureRestic(config.resticVersion);

  // Determine which agents to back up
  let agentsToBackup: AgentConfig[];

  if (opts.agent) {
    const agentConfig = config.agents.find((a) => a.id === opts.agent);
    if (!agentConfig) {
      log.error(`Agent "${opts.agent}" is not configured.`);
      log.info(`Configured agents: ${config.agents.map((a) => a.id).join(", ") || "(none)"}`);
      log.info("Run `agentstash setup` to configure agents.");
      process.exit(1);
    }
    agentsToBackup = [agentConfig];
  } else {
    agentsToBackup = config.agents.filter((a) => a.enabled);
  }

  if (agentsToBackup.length === 0) {
    log.error("No agents configured for backup.");
    log.info("Run `agentstash setup` to configure agents.");
    process.exit(1);
  }

  // Backup each agent
  for (const agentConfig of agentsToBackup) {
    await backupAgent(agentConfig, opts, passphrase, config);
  }

  // Apply retention policy (unless --no-forget)
  if (!opts.dryRun && opts.forget !== false) {
    const forgetSpinner = ora("Applying retention policy...").start();
    try {
      await forget(
        { storage: config.storage, passphrase },
        config.retention,
      );
      forgetSpinner.succeed("Retention policy applied");
    } catch (err) {
      forgetSpinner.warn("Retention policy failed (backup was successful)");
      log.debug(String(err));
    }
  }
}
