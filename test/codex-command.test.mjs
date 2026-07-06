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
  });

  assert.equal(result.command, "D:\\Tools\\codex.exe");
  assert.equal(result.source, "env");
});

test("resolveCodexCommand finds codex on PATH", () => {
  const result = resolveCodexCommand({
    env: { PATH: "C:\\One;C:\\Codex\\bin" },
    exists: (candidate) => candidate === "C:\\Codex\\bin\\codex.exe",
    platform: "win32",
  });

  assert.equal(result.command, "C:\\Codex\\bin\\codex.exe");
  assert.equal(result.source, "path");
});

test("resolveCodexCommand uses colon-delimited PATH on unix platforms", () => {
  const result = resolveCodexCommand({
    env: { PATH: "/usr/local/bin:/opt/codex/bin" },
    exists: (candidate) => candidate === "/opt/codex/bin/codex",
    platform: "darwin",
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
    /Codex CLI not found/,
  );
});

test("buildAppServerArgs targets the local app-server websocket", () => {
  assert.deepEqual(buildAppServerArgs({ port: 19271 }), [
    "app-server",
    "--listen",
    "ws://127.0.0.1:19271",
  ]);
});
