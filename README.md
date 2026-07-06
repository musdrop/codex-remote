# Codex Remote

Standalone remote controller for the official Codex desktop/CLI.

This project extracts the remote collaboration subsystem from `codex-zh` without
bundling or modifying the official Codex app. The desktop daemon runs next to the
official Codex install, starts `codex app-server`, connects to a relay, and serves
the existing web client.

## Current Scope

- No patching of the official Codex app.
- No custom Codex installer.
- Uses the user's official `CODEX_HOME` by default.
- Keeps the original relay, daemon, web client, pairing, E2E encryption, viewer
  sharing, notification, and session-control protocol.

## Layout

| Path | Purpose |
| --- | --- |
| `remote/daemon` | Desktop daemon that starts and proxies `codex app-server`. |
| `remote/web` | Existing browser client. |
| `remote/relay-worker` | Cloudflare Worker relay. |
| `remote/relay-node` | Local/self-hosted Node relay for development. |
| `launcher/` | Remote backend command surface used by desktop tray/menu shells. |
| `src/desktop` | Standalone desktop helpers for locating the official Codex CLI. |

## Run Locally

Start a local relay:

```powershell
npm run remote:relay
```

Start the daemon. If `codex` is not on `PATH`, pass the official CLI path:

```powershell
npm run remote:daemon -- --codex "C:\Path\To\codex.exe" --relay ws://127.0.0.1:8787
```

Generate a pairing URL:

```powershell
npm run remote:pair
```

Open `remote/web/index.html` from an HTTPS/static host for real phone usage. For
local development, use any static server and point the daemon `--web` option at it.

## What Works After Extraction

- Pairing and device-token authentication.
- End-to-end encrypted relay traffic.
- Session list and history viewing from the shared Codex home.
- Realtime rollout tail for sessions written by official Codex or this daemon.
- Sending messages through this daemon's `codex app-server`.
- Approvals for turns started through this daemon.
- Viewer links and read-only sharing.
- Webhook notifications and power management.

## First-Version Limitations

Because the official Codex app is not patched:

- The official desktop UI may not auto-refresh after a remote message is sent.
- Approvals raised by a turn started inside the official desktop UI are not
  guaranteed to be controllable from this daemon.
- Stopping a turn started by the official desktop UI is best-effort only.
- Browser/Computer Use feature gates and localization are outside this project.

## Test

```powershell
npm test
```
