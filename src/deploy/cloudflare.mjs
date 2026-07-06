import { spawnSync as realSpawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

export function buildWorkerDeployCommand({
  root = process.cwd(),
  argv = [],
  env = process.env,
  platform = process.platform,
} = {}) {
  const workerDir = env.CODEX_REMOTE_WORKER_DIR
    ? path.resolve(root, env.CODEX_REMOTE_WORKER_DIR)
    : path.join(root, "remote", "relay-worker");
  return {
    command: "npx",
    args: ["wrangler", "deploy", ...argv],
    cwd: workerDir,
    shell: platform === "win32",
  };
}

export function buildPagesDeployCommand({
  root = process.cwd(),
  argv = [],
  env = process.env,
  platform = process.platform,
} = {}) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "project-name": { type: "string" },
    },
  });
  const webDir = env.CODEX_REMOTE_WEB_DIR
    ? path.resolve(root, env.CODEX_REMOTE_WEB_DIR)
    : path.join(root, "remote", "web");
  const projectName = values["project-name"] || env.CODEX_REMOTE_PAGES_PROJECT || "codex-remote-web";
  return {
    command: "npx",
    args: ["wrangler", "pages", "deploy", webDir, "--project-name", projectName, ...positionals],
    cwd: root,
    shell: platform === "win32",
  };
}

export function runCloudflareDeploy(command, { spawnSync = realSpawnSync } = {}) {
  const result = spawnSync(command.command, command.args, {
    cwd: command.cwd,
    shell: command.shell,
    stdio: "inherit",
  });
  return typeof result.status === "number" ? result.status : 1;
}
