import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsResticInstalled = vi.fn();
const mockGetResticVersion = vi.fn();
const mockLoadConfig = vi.fn();
const mockCheckRepo = vi.fn();
const mockPathExists = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("../src/core/restic-installer.js", () => ({
  isResticInstalled: (...args: unknown[]) => mockIsResticInstalled(...args),
  getResticVersion: (...args: unknown[]) => mockGetResticVersion(...args),
}));

vi.mock("../src/core/config.js", () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
  getResticRepoUrl: (storage: { provider: string; bucket: string; accountId?: string }) =>
    `s3:https://${storage.accountId}.r2.cloudflarestorage.com/${storage.bucket}`,
}));

vi.mock("../src/core/restic.js", () => ({
  checkRepo: (...args: unknown[]) => mockCheckRepo(...args),
}));

vi.mock("../src/core/agents/registry.js", () => ({
  getAgent: (...args: unknown[]) => mockGetAgent(...args),
}));

vi.mock("../src/utils/platform.js", () => ({
  getResticBinaryPath: () => "/mock/bin/restic",
  getAgentstashConfigPath: () => "/mock/.agentstash/config.json",
}));

vi.mock("../src/utils/fs.js", () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
}));

describe("health checks", () => {
  const mockAgentDef = {
    id: "openclaw",
    displayName: "OpenClaw",
    description: "OpenClaw AI coding agent",
    dataDirs: [{ path: "/home/user/.openclaw", description: "OpenClaw data directory", critical: true }],
    categories: {},
    excludes: ["*.lock", "*-wal"],
    detectInstalled: vi.fn().mockReturnValue(true),
    isRunning: vi.fn().mockResolvedValue(false),
  };

  beforeEach(() => {
    mockIsResticInstalled.mockReset();
    mockGetResticVersion.mockReset();
    mockLoadConfig.mockReset();
    mockCheckRepo.mockReset();
    mockPathExists.mockReset();
    mockGetAgent.mockReset();
    mockAgentDef.detectInstalled.mockReturnValue(true);
    mockAgentDef.isRunning.mockResolvedValue(false);
    mockGetAgent.mockReturnValue(mockAgentDef);
  });

  it("returns all OK when everything is healthy", async () => {
    mockIsResticInstalled.mockResolvedValue(true);
    mockGetResticVersion.mockResolvedValue("0.17.3");
    mockLoadConfig.mockResolvedValue({
      agents: [{ id: "openclaw", dataDir: "/home/user/.openclaw", enabled: true }],
      storage: { provider: "r2", bucket: "test", accountId: "abc", accessKeyId: "k", secretAccessKey: "s" },
    });
    mockPathExists.mockResolvedValue(true);
    mockCheckRepo.mockResolvedValue(true);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks("test-pass");

    expect(checks.length).toBeGreaterThanOrEqual(4);

    const resticCheck = checks.find((c) => c.name === "Restic binary");
    expect(resticCheck?.status).toBe("ok");
    expect(resticCheck?.message).toContain("0.17.3");

    const configCheck = checks.find((c) => c.name === "Config");
    expect(configCheck?.status).toBe("ok");

    const agentCheck = checks.find((c) => c.name === "Agent: OpenClaw");
    expect(agentCheck?.status).toBe("ok");

    const processCheck = checks.find((c) => c.name === "  OpenClaw process");
    expect(processCheck?.status).toBe("ok");
    expect(processCheck?.message).toContain("Not running");

    const repoCheck = checks.find((c) => c.name === "Remote repository");
    expect(repoCheck?.status).toBe("ok");
  });

  it("reports error when restic is not installed", async () => {
    mockIsResticInstalled.mockResolvedValue(false);
    mockLoadConfig.mockResolvedValue(null);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks();

    const resticCheck = checks.find((c) => c.name === "Restic binary");
    expect(resticCheck?.status).toBe("error");
    expect(resticCheck?.message).toContain("Not installed");
  });

  it("reports error when config is missing", async () => {
    mockIsResticInstalled.mockResolvedValue(true);
    mockGetResticVersion.mockResolvedValue("0.17.3");
    mockLoadConfig.mockResolvedValue(null);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks();

    const configCheck = checks.find((c) => c.name === "Config");
    expect(configCheck?.status).toBe("error");
    expect(configCheck?.message).toContain("Not found");
  });

  it("reports error when agent data dir does not exist", async () => {
    mockIsResticInstalled.mockResolvedValue(true);
    mockGetResticVersion.mockResolvedValue("0.17.3");
    mockLoadConfig.mockResolvedValue({
      agents: [{ id: "openclaw", dataDir: "/home/user/.openclaw", enabled: true }],
      storage: { provider: "r2", bucket: "test", accountId: "abc", accessKeyId: "k", secretAccessKey: "s" },
    });
    mockPathExists.mockResolvedValue(false);
    mockCheckRepo.mockResolvedValue(true);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks("pass");

    const agentCheck = checks.find((c) => c.name === "Agent: OpenClaw");
    expect(agentCheck?.status).toBe("error");
  });

  it("warns when OpenClaw is running", async () => {
    mockIsResticInstalled.mockResolvedValue(true);
    mockGetResticVersion.mockResolvedValue("0.17.3");
    mockLoadConfig.mockResolvedValue({
      agents: [{ id: "openclaw", dataDir: "/home/user/.openclaw", enabled: true }],
      storage: { provider: "r2", bucket: "test", accountId: "abc", accessKeyId: "k", secretAccessKey: "s" },
    });
    mockPathExists.mockResolvedValue(true);
    mockAgentDef.isRunning.mockResolvedValue(true);
    mockCheckRepo.mockResolvedValue(true);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks("pass");

    const processCheck = checks.find((c) => c.name === "  OpenClaw process");
    expect(processCheck?.status).toBe("warn");
    expect(processCheck?.message).toContain("Running");
  });

  it("warns when no passphrase provided for repo check", async () => {
    mockIsResticInstalled.mockResolvedValue(true);
    mockGetResticVersion.mockResolvedValue("0.17.3");
    mockLoadConfig.mockResolvedValue({
      agents: [{ id: "openclaw", dataDir: "/home/user/.openclaw", enabled: true }],
      storage: { provider: "r2", bucket: "test", accountId: "abc", accessKeyId: "k", secretAccessKey: "s" },
    });
    mockPathExists.mockResolvedValue(true);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks(); // no passphrase

    const repoCheck = checks.find((c) => c.name === "Remote repository");
    expect(repoCheck?.status).toBe("warn");
    expect(repoCheck?.message).toContain("Skipped");
  });

  it("reports error when repo is unreachable", async () => {
    mockIsResticInstalled.mockResolvedValue(true);
    mockGetResticVersion.mockResolvedValue("0.17.3");
    mockLoadConfig.mockResolvedValue({
      agents: [{ id: "openclaw", dataDir: "/home/user/.openclaw", enabled: true }],
      storage: { provider: "r2", bucket: "test", accountId: "abc", accessKeyId: "k", secretAccessKey: "s" },
    });
    mockPathExists.mockResolvedValue(true);
    mockCheckRepo.mockResolvedValue(false);

    const { runHealthChecks } = await import("../src/core/health.js");
    const checks = await runHealthChecks("pass");

    const repoCheck = checks.find((c) => c.name === "Remote repository");
    expect(repoCheck?.status).toBe("error");
    expect(repoCheck?.message).toContain("Cannot reach");
  });
});
