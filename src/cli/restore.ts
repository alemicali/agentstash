import prompts from "prompts";
import ora from "ora";
import chalk from "chalk";
import { homedir } from "node:os";
import { log } from "../utils/logger.js";
import { formatBytes, formatTimeAgo, pathExists } from "../utils/fs.js";
import { requireConfig } from "../core/config.js";
import { getAgent } from "../core/agents/registry.js";
import { ensureRestic } from "../core/restic-installer.js";
import { listSnapshots, restore, type ResticSnapshot } from "../core/restic.js";
import { getPassphrase as getKeychainPassphrase } from "../core/keychain.js";

export interface RestoreOptions {
  passphrase?: string;
  agent?: string;
  only?: string;
  at?: string;
  target?: string;
  dryRun?: boolean;
}

async function resolvePassphrase(opts: RestoreOptions): Promise<string> {
  if (opts.passphrase) return opts.passphrase;
  if (process.env.AGENTSTASH_PASSPHRASE) return process.env.AGENTSTASH_PASSPHRASE;

  const fromKeychain = await getKeychainPassphrase();
  if (fromKeychain) {
    log.debug("Passphrase loaded from system keychain");
    return fromKeychain;
  }

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

  return categoryRule.restoreIncludes;
}

/**
 * Find the best snapshot matching the --at flag.
 */
function findSnapshotByTime(
  snapshots: ResticSnapshot[],
  timeStr: string,
): ResticSnapshot | null {
  // Try to parse as date
  let targetTime: number;

  // Handle relative times like "3 days ago"
  const relativeMatch = timeStr.match(/^(\d+)\s+(minute|hour|day|week|month)s?\s+ago$/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    const multipliers: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
    };
    targetTime = Date.now() - amount * (multipliers[unit] ?? 0);
  } else {
    targetTime = new Date(timeStr).getTime();
    if (isNaN(targetTime)) {
      log.error(`Cannot parse time: ${timeStr}`);
      process.exit(1);
    }
  }

  // Find closest snapshot
  let best: ResticSnapshot | null = null;
  let bestDiff = Infinity;

  for (const snap of snapshots) {
    const snapTime = new Date(snap.time).getTime();
    const diff = Math.abs(snapTime - targetTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = snap;
    }
  }

  return best;
}

export async function restoreCommand(opts: RestoreOptions): Promise<void> {
  const config = await requireConfig();
  const passphrase = await resolvePassphrase(opts);

  // Require --agent flag for restore
  if (!opts.agent) {
    if (config.agents.length === 1) {
      // Auto-select the only configured agent
      opts.agent = config.agents[0].id;
      log.info(`Auto-selected agent: ${opts.agent}`);
    } else {
      log.error("Specify which agent to restore with --agent <id>");
      log.info(`Configured agents: ${config.agents.map((a) => a.id).join(", ") || "(none)"}`);
      process.exit(1);
    }
  }

  const agentConfig = config.agents.find((a) => a.id === opts.agent);
  if (!agentConfig) {
    log.error(`Agent "${opts.agent}" is not configured.`);
    log.info(`Configured agents: ${config.agents.map((a) => a.id).join(", ") || "(none)"}`);
    process.exit(1);
  }

  const agentDef = getAgent(agentConfig.id);
  const agentDisplayName = agentDef?.displayName ?? agentConfig.id;

  await ensureRestic(config.resticVersion);

  const resticOpts = { storage: config.storage, passphrase };

  // Fetch snapshots filtered by agent tag
  const spinner = ora("Loading snapshots...").start();
  const snapshots = await listSnapshots(resticOpts, { tags: [agentConfig.id] });
  spinner.stop();

  if (snapshots.length === 0) {
    log.error(`No snapshots found for ${agentDisplayName}. Run \`agentstash backup --agent ${agentConfig.id}\` first.`);
    process.exit(1);
  }

  // Select snapshot
  let selectedSnapshot: ResticSnapshot;

  if (opts.at) {
    const found = findSnapshotByTime(snapshots, opts.at);
    if (!found) {
      log.error("No snapshot found near that time.");
      process.exit(1);
    }
    selectedSnapshot = found;
    log.info(`Closest snapshot: ${found.short_id} (${formatTimeAgo(new Date(found.time))})`);
  } else {
    // Use latest
    selectedSnapshot = snapshots[snapshots.length - 1];
    log.info(
      `Latest snapshot: ${selectedSnapshot.short_id} (${formatTimeAgo(new Date(selectedSnapshot.time))})`,
    );
  }

  // Target directory: custom target, agent config dataDir, or agent default
  let targetDir: string;
  if (opts.target) {
    targetDir = opts.target;
  } else if (agentConfig.dataDir) {
    targetDir = expandHome(agentConfig.dataDir);
  } else if (agentDef && agentDef.dataDirs.length > 0) {
    targetDir = expandHome(agentDef.dataDirs[0].path);
  } else {
    log.error("Cannot determine restore target. Use --target to specify.");
    process.exit(1);
  }

  // Confirmation
  if (!opts.dryRun) {
    const targetExists = await pathExists(targetDir);
    if (targetExists && !opts.target) {
      log.blank();
      log.warn(`This will overwrite files in ${targetDir}`);
      const { confirmed } = await prompts({
        type: "confirm",
        name: "confirmed",
        message: `Restore ${agentDisplayName} snapshot ${selectedSnapshot.short_id} to ${targetDir}?`,
        initial: false,
      });
      if (!confirmed) {
        log.info("Restore cancelled.");
        return;
      }
    }
  }

  // Build includes for --only
  const includes = getCategoryIncludes(agentConfig.id, opts.only);

  // Restore
  const restoreSpinner = ora(
    opts.dryRun
      ? "Calculating restore (dry run)..."
      : `Restoring ${agentDisplayName} snapshot ${selectedSnapshot.short_id}...`,
  ).start();

  try {
    await restore(selectedSnapshot.id, targetDir, resticOpts, {
      include: includes,
    });

    restoreSpinner.stop();
    log.blank();

    if (opts.dryRun) {
      log.header("Dry run complete");
    } else {
      log.header("Restore complete");
    }

    log.kv("Agent", agentDisplayName, "ok");
    log.kv("Snapshot", selectedSnapshot.short_id, "ok");
    log.kv("From", formatTimeAgo(new Date(selectedSnapshot.time)));
    log.kv("To", targetDir);
    if (opts.only) log.kv("Category", opts.only);
  } catch (err) {
    restoreSpinner.fail("Restore failed");
    log.error(String(err));
    process.exit(1);
  }
}
