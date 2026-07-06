import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

export function resolveCodexCommand({
  env = process.env,
  exists = existsSync,
  platform = process.platform,
  validate = (candidate) => validateCodexDesktopEngine(candidate, { platform }),
} = {}) {
  const explicit = env.CODEX_REMOTE_CODEX?.trim();
  if (explicit) {
    if (!exists(explicit)) {
      throw new Error(`未找到 Codex Desktop 引擎路径: ${explicit}`);
    }
    const appCli = officialWindowsAppCli(explicit, exists, platform);
    if (appCli) {
      assertValidCommand(appCli, validate);
      return { command: appCli, source: "env-app-shell" };
    }
    assertValidCommand(explicit, validate);
    return { command: explicit, source: "env" };
  }

  let lastInvalid = "";
  for (const dir of pathEntries(env.PATH, platform)) {
    for (const candidate of commandCandidates(dir, platform)) {
      if (exists(candidate)) {
        const appCli = officialWindowsAppCli(candidate, exists, platform);
        const command = appCli ?? candidate;
        const validation = normalizeValidation(validate(command));
        if (validation.ok) {
          return { command, source: "path" };
        }
        lastInvalid = validation.reason ? `${command}: ${validation.reason}` : command;
      }
    }
  }

  throw new Error(
    [
      "未找到可用的 Codex Desktop 引擎。",
      "请安装官方 Codex Desktop，或在设置中选择官方安装目录里的 app\\resources\\codex.exe。",
      lastInvalid ? `最近跳过的候选: ${lastInvalid}` : "",
    ].filter(Boolean).join(" "),
  );
}

export function buildAppServerArgs({ port = 19271 } = {}) {
  return ["app-server", "--listen", `ws://127.0.0.1:${Number(port)}`];
}

export function validateCodexDesktopEngine(command, {
  platform = process.platform,
  spawn = spawnSync,
  timeoutMs = 5000,
} = {}) {
  if (platform === "win32" && /\.(cmd|ps1)$/i.test(command)) {
    return {
      ok: false,
      reason: "Windows cmd/ps1 shim 可能来自 npm 全局命令，不作为 Codex Desktop 引擎使用",
    };
  }

  let result;
  try {
    result = spawn(command, ["app-server", "--help"], {
      encoding: "utf8",
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }

  if (result.error) {
    return { ok: false, reason: result.error.message };
  }
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "").trim();
    return {
      ok: false,
      reason: detail || `app-server 探测退出码 ${result.status}`,
    };
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/Usage:\s+codex app-server/i.test(output) && /--listen\s+<URL>/i.test(output)) {
    return { ok: true };
  }
  return { ok: false, reason: "未检测到 app-server --listen 能力" };
}

function commandCandidates(dir, platform) {
  if (platform !== "win32") return [path.posix.join(dir, "codex")];
  return ["codex.exe", "Codex.exe"].map((name) =>
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

function assertValidCommand(command, validate) {
  const validation = normalizeValidation(validate(command));
  if (!validation.ok) {
    throw new Error(
      `不是可用的 Codex Desktop 引擎: ${command}${validation.reason ? ` (${validation.reason})` : ""}`,
    );
  }
}

function normalizeValidation(result) {
  if (result === true) return { ok: true };
  if (result === false) return { ok: false };
  return result && typeof result === "object" ? result : { ok: Boolean(result) };
}
