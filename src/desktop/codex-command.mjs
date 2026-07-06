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
    return { command: explicit, source: "env" };
  }

  const executable = platform === "win32" ? "codex.exe" : "codex";
  for (const dir of pathEntries(env.PATH, platform)) {
    const candidate = platform === "win32"
      ? path.win32.join(dir, executable)
      : path.posix.join(dir, executable);
    if (exists(candidate)) {
      return { command: candidate, source: "path" };
    }
  }

  throw new Error(
    "Codex CLI not found. Install the official Codex app/CLI or set CODEX_REMOTE_CODEX to the codex executable.",
  );
}

export function buildAppServerArgs({ port = 19271 } = {}) {
  return ["app-server", "--listen", `ws://127.0.0.1:${Number(port)}`];
}

function pathEntries(value, platform) {
  const delimiter = platform === "win32" ? ";" : ":";
  return String(value ?? "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
