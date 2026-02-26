# agentstash

**Encrypted incremental backups for AI coding agents.**
Set it up once, never think about it again.

[![npm](https://img.shields.io/npm/v/agentstash)](https://www.npmjs.com/package/agentstash) [![MIT License](https://img.shields.io/github/license/alemicali/agentstash)](https://github.com/alemicali/agentstash/blob/main/LICENSE)

---

AI coding agents store sessions, config, credentials, and memory locally. If your disk dies, you lose everything. **agentstash** fixes that with encrypted, deduplicated, incremental backups to any S3-compatible storage.

## Supported agents

| Agent | Data directory | What gets backed up |
|-------|---------------|---------------------|
| **Claude Code** | `~/.claude/` | Sessions, credentials, settings, skills, history, plans |
| **OpenCode** | `~/.local/share/opencode/` | SQLite DB (sessions), auth, snapshots, state, history |
| **Gemini CLI** | `~/.gemini/` | Settings, API keys, checkpoints, history, memory |
| **OpenAI Codex** | `~/.codex/` | Config, auth |
| **OpenClaw** | `~/.openclaw/` | Config, credentials, workspace, sessions, memory, skills |
| **Aider** | `~/` (dotfiles) | Config, chat history, model settings |
| **Continue** | `~/.continue/` | Config, sessions |
| **Cursor** | `~/.cursor/` | Settings, keybindings |
| **GitHub Copilot** | `~/.config/github-copilot/` | Auth, settings |

Auto-detects which agents are installed during setup.

## Install

Requires **Node >= 18**.

```bash
# Run without installing
npx agentstash setup

# Or install globally
npm install -g agentstash
```

## Quick start

```bash
# Interactive setup wizard — auto-detects your agents
agentstash setup

# That's it. The daemon backs up every hour.
# Check status anytime:
agentstash status

# Disaster recovery on a new machine:
agentstash restore --agent claude-code
```

## How it works

agentstash wraps [restic](https://restic.net), the battle-tested backup tool. It auto-downloads the restic binary on first run.

```
~/.claude/                            S3-compatible storage
~/.local/share/opencode/              (Cloudflare R2, AWS S3,
~/.gemini/               ──encrypt──   Backblaze B2, MinIO)
~/.openclaw/             ──dedup───▶
~/.codex/                ──upload──   Only changed blocks
~/.continue/                          get transferred.
~/.*aider*                            AES-256 encrypted.
```

**First backup**: full upload.
**Subsequent backups**: only changed blocks. Change 1 byte in a 200MB SQLite file? ~4KB uploaded.

## Commands

```
agentstash setup                              Interactive wizard
agentstash backup                             Backup all enabled agents
agentstash backup --agent claude-code         Backup a specific agent
agentstash backup --only sessions             Backup only session data
agentstash backup --dry-run                   Show what would be backed up
agentstash restore --agent claude-code        Restore an agent's data
agentstash restore --at "3 days ago"          Point-in-time restore
agentstash restore --only config              Restore only config files
agentstash restore --target ~/tmp             Restore to custom directory
agentstash snapshots                          List all backup snapshots
agentstash snapshots --agent opencode         List snapshots for one agent
agentstash status                             Show backup health and info
agentstash forget                             Apply retention policy
agentstash doctor                             Run diagnostic checks
agentstash daemon install                     Install background backup service
agentstash daemon uninstall                   Remove background service
agentstash daemon status                      Check service status
```

## Selective backup and restore

Each agent's data is categorized into standard categories:

| Category | What it includes |
|----------|-----------------|
| `config` | Main configuration files |
| `secrets` | Credentials, API keys, auth tokens |
| `sessions` | Conversation history and chat logs |
| `memory` | Persistent memory and knowledge bases |
| `skills` | Custom skills, plugins, extensions |
| `workspace` | Workspace and project-specific data |
| `settings` | User preferences and UI state |
| `history` | Input and prompt history |

```bash
# Backup only sessions across all agents
agentstash backup --only sessions

# Restore only config for Claude Code
agentstash restore --agent claude-code --only config

# Restore from 3 days ago
agentstash restore --agent opencode --at "3 days ago"
```

## Configuration

Stored at `~/.agentstash/config.json`. Created by `agentstash setup`.

```json5
{
  "version": 1,
  "agents": [
    { "id": "claude-code", "enabled": true },
    { "id": "opencode", "enabled": true },
    { "id": "gemini", "enabled": true },
    { "id": "openclaw", "dataDir": "~/.openclaw", "enabled": true }
  ],
  "storage": {
    "provider": "r2",
    "bucket": "my-agentstash",
    "accountId": "...",
    "accessKeyId": "...",
    "secretAccessKey": "..."
  },
  "retention": {
    "keepLast": 7,
    "keepDaily": 30,
    "keepWeekly": 12,
    "keepMonthly": 6
  },
  "daemon": {
    "enabled": true,
    "intervalMinutes": 60
  },
  "exclude": []
}
```

### Passphrase

The encryption passphrase is **not** stored in the config file. During setup, agentstash saves it to your system keychain:

- **macOS**: Keychain Access
- **Linux**: GNOME Keyring / KDE Wallet

Resolution order: `--passphrase` flag > `AGENTSTASH_PASSPHRASE` env var > system keychain.

## Supported storage providers

| Provider | Config | Notes |
|----------|--------|-------|
| Cloudflare R2 | `r2` | Generous free tier, no egress fees |
| AWS S3 | `s3` | Standard S3 |
| Backblaze B2 | `b2` | Affordable, S3-compatible |
| MinIO | `minio` | Self-hosted |

## Background service

`agentstash daemon install` sets up:

- **macOS**: launchd LaunchAgent
- **Linux**: systemd user timer + service

Runs `agentstash backup` at the configured interval (default: every 60 minutes).

## Security

- **AES-256** encryption before data leaves your machine
- Key derived from passphrase via scrypt (restic default)
- Storage provider only sees opaque encrypted blobs
- Passphrase stored in OS-native keychain, never in config files

## Platforms

- **macOS** (Intel + Apple Silicon)
- **Linux** (x64 + arm64)
- **Windows** via WSL2

## Based on

agentstash is a fork of [clawstash](https://github.com/alemicali/clawstash), extended to support all major AI coding agents.

## License

MIT
