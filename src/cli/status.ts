import ora from "ora";
import chalk from "chalk";
import { homedir } from "node:os";
import { log } from "../utils/logger.js";
import { formatBytes, formatTimeAgo, pathExists } from "../utils/fs.js";
import { loadConfig, getResticRepoUrl } from "../core/config.js";
import { getAgent } from "../core/agents/registry.js";
import { ensureRestic } from "../core/restic-installer.js";
import { listSnapshots, stats } from "../core/restic.js";
import { getPassphrase as getKeychainPassphrase } from "../core/keychain.js";

export interface StatusOptions {
  passphrase?: string;
}

/**
 * Resolve ~ to home directory in a path.
 */
function expandHome(p: string): string {
  if (p.startsWith("~/")) return p.replace("~", homedir());
  if (p === "~") return homedir();
  return p;
}

export async function statusCommand(opts: StatusOptions): Promise<void> {
  const config = await loadConfig();

  if (!config) {
    log.error("agentstash is not configured. Run `agentstash setup` first.");
    process.exit(1);
  }

  log.header("agentstash status");

  // Show status for each configured agent
  if (config.agents.length === 0) {
    log.kv("Agents", "None configured", "warn");
  } else {
    log.kv("Agents", `${config.agents.length} configured`);
    log.blank();

    for (const agentConfig of config.agents) {
      const agentDef = getAgent(agentConfig.id);
      const displayName = agentDef?.displayName ?? agentConfig.id;
      const installed = agentDef?.detectInstalled() ?? false;
      const enabledStr = agentConfig.enabled ? chalk.green("enabled") : chalk.dim("disabled");
      const installedStr = installed ? chalk.green("installed") : chalk.yellow("not found");

      log.info(`  ${chalk.bold(displayName)} (${enabledStr}, ${installedStr})`);

      // Show data directories
      const dataDirs = agentConfig.dataDir
        ? [agentConfig.dataDir]
        : agentDef?.dataDirs.map((d) => d.path) ?? [];

      for (const dir of dataDirs) {
        const resolved = expandHome(dir);
        const exists = await pathExists(resolved);
        const statusStr = exists ? chalk.green("exists") : chalk.yellow("missing");
        log.info(`    ${chalk.dim(resolved)} ${statusStr}`);
      }

      // Size estimate
      if (agentDef?.estimateSize) {
        try {
          const size = await agentDef.estimateSize();
          log.info(`    ${chalk.dim(`Size: ~${formatBytes(size)}`)}`);
        } catch {
          // ignore
        }
      }
    }
  }

  // Storage info
  log.blank();
  log.kv("Storage", `${config.storage.provider.toUpperCase()} / ${config.storage.bucket}`);
  log.kv("Repository", getResticRepoUrl(config.storage));

  const passphrase = opts.passphrase
    ?? process.env.AGENTSTASH_PASSPHRASE
    ?? await getKeychainPassphrase();

  if (!passphrase) {
    log.blank();
    log.kv("Snapshots", "Skipped (no passphrase)", "warn");
    log.info(chalk.dim("Set AGENTSTASH_PASSPHRASE or save to keychain via `agentstash setup`."));
    return;
  }

  await ensureRestic(config.resticVersion);

  // Fetch remote info
  const spinner = ora("Checking remote...").start();

  try {
    const [allSnapshots, repoStats] = await Promise.all([
      listSnapshots({ storage: config.storage, passphrase }),
      stats({ storage: config.storage, passphrase }),
    ]);

    spinner.stop();

    log.blank();

    if (allSnapshots.length > 0) {
      const latest = allSnapshots[allSnapshots.length - 1];
      const latestDate = new Date(latest.time);
      log.kv("Last backup", `${formatTimeAgo(latestDate)} (${latest.short_id})`, "ok");
      log.kv("Total snapshots", String(allSnapshots.length));

      // Per-agent last backup
      if (config.agents.length > 1) {
        log.blank();
        log.info(chalk.dim("  Per-agent last backup:"));
        for (const agentConfig of config.agents) {
          const agentDef = getAgent(agentConfig.id);
          const displayName = agentDef?.displayName ?? agentConfig.id;
          const agentSnaps = allSnapshots.filter(
            (s) => s.tags?.includes(agentConfig.id),
          );
          if (agentSnaps.length > 0) {
            const agentLatest = agentSnaps[agentSnaps.length - 1];
            const agentDate = new Date(agentLatest.time);
            log.info(`    ${displayName}: ${formatTimeAgo(agentDate)} (${agentLatest.short_id})`);
          } else {
            log.info(`    ${displayName}: ${chalk.yellow("never")}`);
          }
        }
      }
    } else {
      log.kv("Last backup", "Never", "warn");
    }

    log.kv("Repo size", formatBytes(repoStats.total_size));

    // Retention info
    log.blank();
    log.kv("Retention", [
      `${config.retention.keepLast} latest`,
      `${config.retention.keepDaily} daily`,
      `${config.retention.keepWeekly} weekly`,
      `${config.retention.keepMonthly} monthly`,
    ].join(", "));

    // Daemon info
    if (config.daemon.enabled) {
      log.kv("Auto-backup", `Every ${config.daemon.intervalMinutes} minutes`, "ok");
    } else {
      log.kv("Auto-backup", "Disabled (manual only)", "warn");
    }

  } catch (err) {
    spinner.fail("Failed to check remote");
    log.error(String(err));
  }
}
