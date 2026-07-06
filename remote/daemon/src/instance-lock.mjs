import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

export function acquireDaemonLock(configPath, {
  pid = process.pid,
  processExists = isProcessAlive,
} = {}) {
  const lockDir = `${configPath}.lock`;
  const pidFile = path.join(lockDir, "pid");

  try {
    mkdirSync(lockDir, { recursive: false });
  } catch (err) {
    if (err?.code !== "EEXIST") throw err;
    const ownerPid = readOwnerPid(pidFile);
    if (ownerPid && processExists(ownerPid)) {
      throw new Error(
        `Codex Remote daemon 已在运行（pid=${ownerPid}）。请先停止已有托盘/计划任务或正在运行的 remote:daemon。`,
      );
    }
    rmSync(lockDir, { recursive: true, force: true });
    mkdirSync(lockDir, { recursive: false });
  }

  writeFileSync(pidFile, String(pid), "utf8");
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      if (readOwnerPid(pidFile) === pid) {
        rmSync(lockDir, { recursive: true, force: true });
      }
    },
  };
}

function readOwnerPid(pidFile) {
  try {
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
