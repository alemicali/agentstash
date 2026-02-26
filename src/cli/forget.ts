import ora from "ora";
import { log } from "../utils/logger.js";
import { requireConfig } from "../core/config.js";
import { ensureRestic } from "../core/restic-installer.js";
import { forget, listSnapshots } from "../core/restic.js";
import { getPassphrase as getKeychainPassphrase } from "../core/keychain.js";

export interface ForgetOptions {
  passphrase?: string;
  agent?: string;
}

async function resolvePassphrase(opts: ForgetOptions): Promise<string> {
  if (opts.passphrase) return opts.passphrase;
  if (process.env.AGENTSTASH_PASSPHRASE) return process.env.AGENTSTASH_PASSPHRASE;
  const fromKeychain = await getKeychainPassphrase();
  if (fromKeychain) return fromKeychain;
  log.error("No passphrase found.");
  log.info("Run `agentstash setup` to save it to keychain, or set AGENTSTASH_PASSPHRASE env var.");
  process.exit(1);
}

export async function forgetCommand(opts: ForgetOptions): Promise<void> {
  const config = await requireConfig();
  const passphrase = await resolvePassphrase(opts);

  await ensureRestic(config.resticVersion);

  const resticOpts = { storage: config.storage, passphrase };

  // Filter by agent tag if specified
  const tags = opts.agent ? [opts.agent] : undefined;

  // Count before
  const before = await listSnapshots(resticOpts, { tags });

  const label = opts.agent
    ? `Applying retention policy for "${opts.agent}" and pruning...`
    : "Applying retention policy and pruning...";
  const spinner = ora(label).start();

  try {
    await forget(resticOpts, config.retention, { tags });
    spinner.stop();

    // Count after
    const after = await listSnapshots(resticOpts, { tags });
    const removed = before.length - after.length;

    log.blank();
    log.header(opts.agent ? `Retention applied (${opts.agent})` : "Retention applied");
    log.kv("Before", `${before.length} snapshots`);
    log.kv("After", `${after.length} snapshots`);
    log.kv("Removed", `${removed} snapshots`, removed > 0 ? "ok" : undefined);
  } catch (err) {
    spinner.fail("Failed to apply retention policy");
    log.error(String(err));
    process.exit(1);
  }
}
