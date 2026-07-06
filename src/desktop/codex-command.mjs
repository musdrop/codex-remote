import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export function resolveCodexCommand({
  env = process.env,
  exists = existsSync,
  platform = process.platform,
} = {}) {
  const explicit = env.CODEX_REMOTE_CODEX?.trim();
  if (explicit) {
    if (!exists(explicit)) {
      throw new Error(`Codex CLI not found at CODEX_REMOTE_CODEX: ${explicit}`);
    }
    const appCli = officialWindowsAppCli(explicit, exists, platform);
    if (appCli) {
      return { command: appCli, source: "env-app-shell" };
    }
    return { command: explicit, source: "env" };
  }

  for (const dir of pathEntries(env.PATH, platform)) {
    for (const candidate of commandCandidates(dir, platform)) {
      if (exists(candidate)) {
        const appCli = officialWindowsAppCli(candidate, exists, platform);
        return { command: appCli ?? candidate, source: "path" };
      }
    }
  }

  throw new Error(
    "Codex CLI not found. Install the official Codex app/CLI or set CODEX_REMOTE_CODEX to the codex executable.",
  );
}

export function buildAppServerArgs({ port = 19271 } = {}) {
  return ["app-server", "--listen", `ws://127.0.0.1:${Number(port)}`];
}

function commandCandidates(dir, platform) {
  if (platform !== "win32") return [path.posix.join(dir, "codex")];
  return ["codex.exe", "codex.cmd", "codex.ps1", "codex"].map((name) =>
    path.win32.join(dir, name));
}

function officialWindowsAppCli(command, exists, platform) {
  if (platform !== "win32") return null;
  const parsed = path.win32.parse(command);
  if (parsed.base !== "Codex.exe") return null;
  const cli = path.win32.join(parsed.dir, "resources", "codex.exe");
  return exists(cli) ? cli : null;
}

function pathEntries(value, platform) {
  const delimiter = platform === "win32" ? ";" : ":";
  return String(value ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
