import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { acquireDaemonLock } from "../remote/daemon/src/instance-lock.mjs";

function tempPath() {
  const dir = mkdtempSync(join(tmpdir(), "czr-lock-"));
  return { dir, configPath: join(dir, "daemon.json") };
}

test("acquireDaemonLock creates a pid lock and release removes it", () => {
  const { dir, configPath } = tempPath();
  try {
    const lock = acquireDaemonLock(configPath, { pid: 1234, processExists: () => true });
    assert.equal(existsSync(`${configPath}.lock`), true);
    assert.equal(readFileSync(join(`${configPath}.lock`, "pid"), "utf8"), "1234");
    lock.release();
    assert.equal(existsSync(`${configPath}.lock`), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireDaemonLock rejects a second live daemon for the same config", () => {
  const { dir, configPath } = tempPath();
  try {
    const first = acquireDaemonLock(configPath, { pid: 1111, processExists: () => true });
    assert.throws(
      () => acquireDaemonLock(configPath, { pid: 2222, processExists: () => true }),
      /Codex Remote daemon 已在运行/,
    );
    first.release();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("acquireDaemonLock removes a stale lock and lets the new daemon start", () => {
  const { dir, configPath } = tempPath();
  try {
    acquireDaemonLock(configPath, { pid: 1111, processExists: () => true });
    const second = acquireDaemonLock(configPath, {
      pid: 2222,
      processExists: (pid) => pid !== 1111,
    });
    assert.equal(readFileSync(join(`${configPath}.lock`, "pid"), "utf8"), "2222");
    second.release();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
