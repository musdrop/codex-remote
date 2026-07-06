import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAppServerArgs,
  resolveCodexCommand,
} from "../src/desktop/codex-command.mjs";

test("resolveCodexCommand prefers an explicit command from env", () => {
  const result = resolveCodexCommand({
    env: { CODEX_REMOTE_CODEX: "D:\\Tools\\codex.exe", PATH: "" },
    exists: (candidate) => candidate === "D:\\Tools\\codex.exe",
    platform: "win32",
    validate: (candidate) => ({ ok: candidate === "D:\\Tools\\codex.exe" }),
  });

  assert.equal(result.command, "D:\\Tools\\codex.exe");
  assert.equal(result.source, "env");
});

test("resolveCodexCommand rejects an explicit command that cannot run app-server", () => {
  assert.throws(
    () =>
      resolveCodexCommand({
        env: { CODEX_REMOTE_CODEX: "D:\\Tools\\codex.exe", PATH: "" },
        exists: (candidate) => candidate === "D:\\Tools\\codex.exe",
        platform: "win32",
        validate: () => ({ ok: false, reason: "missing app-server" }),
      }),
    /不是可用的 Codex Desktop 内置 Codex CLI/,
  );
});

test("resolveCodexCommand maps the official Windows app shell to the bundled Codex CLI", () => {
  const result = resolveCodexCommand({
    env: { CODEX_REMOTE_CODEX: "E:\\WindowsApps\\OpenAICodex\\app\\Codex.exe", PATH: "" },
    exists: (candidate) =>
      candidate === "E:\\WindowsApps\\OpenAICodex\\app\\Codex.exe" ||
      candidate === "E:\\WindowsApps\\OpenAICodex\\app\\resources\\codex.exe",
    platform: "win32",
    validate: (candidate) => ({
      ok: candidate === "E:\\WindowsApps\\OpenAICodex\\app\\resources\\codex.exe",
    }),
  });

  assert.equal(result.command, "E:\\WindowsApps\\OpenAICodex\\app\\resources\\codex.exe");
  assert.equal(result.source, "env-app-shell");
});

test("resolveCodexCommand finds codex on PATH", () => {
  const result = resolveCodexCommand({
    env: { PATH: "C:\\One;C:\\Codex\\bin" },
    exists: (candidate) => candidate === "C:\\Codex\\bin\\codex.exe",
    platform: "win32",
    validate: (candidate) => ({ ok: candidate === "C:\\Codex\\bin\\codex.exe" }),
  });

  assert.equal(result.command, "C:\\Codex\\bin\\codex.exe");
  assert.equal(result.source, "path");
});

test("resolveCodexCommand skips npm codex.cmd on Windows PATH", () => {
  assert.throws(
    () =>
      resolveCodexCommand({
        env: { PATH: "C:\\Users\\me\\AppData\\Roaming\\npm" },
        exists: (candidate) => candidate === "C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd",
        platform: "win32",
        validate: () => ({ ok: true }),
      }),
    /未找到可用的 Codex Desktop 内置 Codex CLI/,
  );
});

test("resolveCodexCommand skips codex.exe candidates that fail validation", () => {
  const result = resolveCodexCommand({
    env: { PATH: "C:\\Bad;C:\\Good" },
    exists: (candidate) =>
      candidate === "C:\\Bad\\codex.exe" ||
      candidate === "C:\\Good\\codex.exe",
    platform: "win32",
    validate: (candidate) => ({
      ok: candidate === "C:\\Good\\codex.exe",
      reason: "missing app-server",
    }),
  });

  assert.equal(result.command, "C:\\Good\\codex.exe");
  assert.equal(result.source, "path");
});

test("resolveCodexCommand uses colon-delimited PATH on unix platforms", () => {
  const result = resolveCodexCommand({
    env: { PATH: "/usr/local/bin:/opt/codex/bin" },
    exists: (candidate) => candidate === "/opt/codex/bin/codex",
    platform: "darwin",
    validate: (candidate) => ({ ok: candidate === "/opt/codex/bin/codex" }),
  });

  assert.equal(result.command, "/opt/codex/bin/codex");
  assert.equal(result.source, "path");
});

test("resolveCodexCommand returns a useful error when codex is missing", () => {
  assert.throws(
    () =>
      resolveCodexCommand({
        env: { PATH: "" },
        exists: () => false,
        platform: "win32",
      }),
    /未找到可用的 Codex Desktop 内置 Codex CLI/,
  );
});

test("validateBundledCodexCli checks for app-server help output", async () => {
  const { validateBundledCodexCli } = await import("../src/desktop/codex-command.mjs");
  const ok = validateBundledCodexCli("D:\\Codex\\codex.exe", {
    platform: "win32",
    spawn: () => ({
      status: 0,
      stdout: "Usage: codex app-server [OPTIONS]\n--listen <URL>",
      stderr: "",
    }),
  });

  assert.equal(ok.ok, true);
});

test("validateBundledCodexCli rejects Windows command shims", async () => {
  const { validateBundledCodexCli } = await import("../src/desktop/codex-command.mjs");
  const result = validateBundledCodexCli("C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd", {
    platform: "win32",
    spawn: () => {
      throw new Error("should not spawn shim");
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /cmd\/ps1/);
});

test("buildAppServerArgs targets the local app-server websocket", () => {
  assert.deepEqual(buildAppServerArgs({ port: 19271 }), [
    "app-server",
    "--listen",
    "ws://127.0.0.1:19271",
  ]);
});
