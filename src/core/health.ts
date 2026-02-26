import { homedir } from "node:os";
import { getResticBinaryPath, getAgentstashConfigPath } from "../utils/platform.js";
import { pathExists } from "../utils/fs.js";
import { isResticInstalled, getResticVersion } from "./restic-installer.js";
import { loadConfig, getResticRepoUrl } from "./config.js";
import { checkRepo } from "./restic.js";
import { getAgent } from "./agents/registry.js";

export interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
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
 * Run all health checks and return results.
 */
export async function runHealthChecks(passphrase?: string): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // 1. Restic binary
  if (await isResticInstalled()) {
    const version = await getResticVersion();
    checks.push({
      name: "Restic binary",
      status: "ok",
      message: `v${version} (${getResticBinaryPath()})`,
    });
  } else {
    checks.push({
      name: "Restic binary",
      status: "error",
      message: "Not installed. Run `agentstash setup`",
    });
  }

  // 2. Config file
  const config = await loadConfig();
  if (config) {
    checks.push({
      name: "Config",
      status: "ok",
      message: getAgentstashConfigPath(),
    });
  } else {
    checks.push({
      name: "Config",
      status: "error",
      message: "Not found. Run `agentstash setup`",
    });
  }

  // 3. Per-agent checks
  if (config) {
    if (config.agents.length === 0) {
      checks.push({
        name: "Agents",
        status: "warn",
        message: "No agents configured. Run `agentstash setup`",
      });
    }

    for (const agentConfig of config.agents) {
      const agentDef = getAgent(agentConfig.id);
      const displayName = agentDef?.displayName ?? agentConfig.id;

      // Is agent registered?
      if (!agentDef) {
        checks.push({
          name: `Agent: ${displayName}`,
          status: "warn",
          message: "Unknown agent (not in registry)",
        });
        continue;
      }

      // Is agent installed?
      const installed = agentDef.detectInstalled();
      if (!installed) {
        checks.push({
          name: `Agent: ${displayName}`,
          status: "warn",
          message: "Not installed on this system",
        });
        continue;
      }

      // Check data directories exist and are accessible
      const dataDirs = agentConfig.dataDir
        ? [agentConfig.dataDir]
        : agentDef.dataDirs.map((d) => d.path);

      let allDirsOk = true;
      const dirMessages: string[] = [];

      for (const dir of dataDirs) {
        const resolved = expandHome(dir);
        const exists = await pathExists(resolved);
        if (!exists) {
          allDirsOk = false;
          dirMessages.push(`${resolved} missing`);
        }
      }

      if (allDirsOk) {
        checks.push({
          name: `Agent: ${displayName}`,
          status: "ok",
          message: `Installed (${dataDirs.map((d) => expandHome(d)).join(", ")})`,
        });
      } else {
        checks.push({
          name: `Agent: ${displayName}`,
          status: "error",
          message: `Data dir issue: ${dirMessages.join("; ")}`,
        });
      }

      // Check if running
      if (agentDef.isRunning) {
        const running = await agentDef.isRunning();
        if (running) {
          checks.push({
            name: `  ${displayName} process`,
            status: "warn",
            message: "Running (SQLite may be locked during backup)",
          });
        } else {
          checks.push({
            name: `  ${displayName} process`,
            status: "ok",
            message: "Not running (safe to backup)",
          });
        }
      }
    }
  }

  // 4. Remote repository
  if (config && passphrase) {
    const repoOk = await checkRepo({
      storage: config.storage,
      passphrase,
    });
    if (repoOk) {
      checks.push({
        name: "Remote repository",
        status: "ok",
        message: getResticRepoUrl(config.storage),
      });
    } else {
      checks.push({
        name: "Remote repository",
        status: "error",
        message: "Cannot reach repository. Check credentials and network.",
      });
    }
  } else if (config && !passphrase) {
    checks.push({
      name: "Remote repository",
      status: "warn",
      message: "Skipped (no passphrase provided, use --passphrase or AGENTSTASH_PASSPHRASE)",
    });
  }

  return checks;
}
