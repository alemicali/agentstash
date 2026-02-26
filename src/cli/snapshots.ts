import ora from "ora";
import chalk from "chalk";
import { log } from "../utils/logger.js";
import { formatTimeAgo } from "../utils/fs.js";
import { requireConfig } from "../core/config.js";
import { getAgent } from "../core/agents/registry.js";
import { ensureRestic } from "../core/restic-installer.js";
import { listSnapshots } from "../core/restic.js";
import { getPassphrase as getKeychainPassphrase } from "../core/keychain.js";

export interface SnapshotsOptions {
  passphrase?: string;
  agent?: string;
}

async function resolvePassphrase(opts: SnapshotsOptions): Promise<string> {
  if (opts.passphrase) return opts.passphrase;
  if (process.env.AGENTSTASH_PASSPHRASE) return process.env.AGENTSTASH_PASSPHRASE;
  const fromKeychain = await getKeychainPassphrase();
  if (fromKeychain) return fromKeychain;
  log.error("No passphrase found.");
  log.info("Run `agentstash setup` to save it to keychain, or set AGENTSTASH_PASSPHRASE env var.");
  process.exit(1);
}

/**
 * Resolve agent display name from a tag.
 */
function getAgentNameFromTag(tags: string[] | null): string | null {
  if (!tags) return null;
  for (const tag of tags) {
    if (tag === "agentstash") continue;
    const agentDef = getAgent(tag);
    if (agentDef) return agentDef.displayName;
  }
  return null;
}

export async function snapshotsCommand(opts: SnapshotsOptions): Promise<void> {
  const config = await requireConfig();
  const passphrase = await resolvePassphrase(opts);

  await ensureRestic(config.resticVersion);

  // Filter by agent tag if specified
  const tags = opts.agent ? [opts.agent] : undefined;

  const spinner = ora("Loading snapshots...").start();
  const snapshots = await listSnapshots({
    storage: config.storage,
    passphrase,
  }, { tags });
  spinner.stop();

  if (snapshots.length === 0) {
    if (opts.agent) {
      log.info(`No snapshots found for agent "${opts.agent}". Run \`agentstash backup --agent ${opts.agent}\` to create one.`);
    } else {
      log.info("No snapshots yet. Run `agentstash backup` to create one.");
    }
    return;
  }

  const title = opts.agent
    ? `Snapshots for ${opts.agent} (${snapshots.length})`
    : `Snapshots (${snapshots.length})`;
  log.header(title);

  // Table header
  const header =
    chalk.dim("  ID        Date                      Agent           Tags");
  log.raw(header);
  log.raw(chalk.dim("  " + "-".repeat(75)));

  for (const snap of snapshots) {
    const id = chalk.white(snap.short_id.padEnd(10));
    const date = new Date(snap.time);
    const dateStr = date.toISOString().replace("T", " ").slice(0, 19);
    const ago = chalk.dim(`(${formatTimeAgo(date)})`);
    const agentName = getAgentNameFromTag(snap.tags);
    const agentStr = agentName
      ? chalk.cyan(agentName.padEnd(16))
      : chalk.dim("—".padEnd(16));
    const displayTags = snap.tags?.filter((t) => t !== "agentstash" && !getAgent(t)) ?? [];
    const tagsStr = displayTags.length > 0 ? chalk.dim(displayTags.join(", ")) : chalk.dim("—");

    log.raw(`  ${id}${dateStr}  ${ago.padEnd(25)} ${agentStr}${tagsStr}`);
  }

  log.blank();
  log.info(chalk.dim(`Restore any snapshot: agentstash restore --agent <id> --at "${snapshots[snapshots.length - 1].short_id}"`));
}
