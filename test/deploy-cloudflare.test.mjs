import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPagesDeployCommand,
  buildWorkerDeployCommand,
  runCloudflareDeploy,
} from "../src/deploy/cloudflare.mjs";

test("buildWorkerDeployCommand deploys the relay worker from its directory", () => {
  const command = buildWorkerDeployCommand({
    root: "D:\\DevelopProgram\\codex-remote",
    env: {},
    platform: "win32",
  });

  assert.equal(command.command, "npx");
  assert.deepEqual(command.args, ["wrangler", "deploy"]);
  assert.equal(command.cwd, "D:\\DevelopProgram\\codex-remote\\remote\\relay-worker");
  assert.equal(command.shell, true);
});

test("buildPagesDeployCommand deploys remote/web without a build step", () => {
  const command = buildPagesDeployCommand({
    root: "D:\\DevelopProgram\\codex-remote",
    argv: ["--project-name", "my-codex-remote"],
    env: {},
    platform: "win32",
  });

  assert.equal(command.command, "npx");
  assert.deepEqual(command.args, [
    "wrangler",
    "pages",
    "deploy",
    "D:\\DevelopProgram\\codex-remote\\remote\\web",
    "--project-name",
    "my-codex-remote",
  ]);
  assert.equal(command.cwd, "D:\\DevelopProgram\\codex-remote");
  assert.equal(command.shell, true);
});

test("buildPagesDeployCommand uses an env project name or the default", () => {
  assert.deepEqual(
    buildPagesDeployCommand({
      root: "/repo",
      env: { CODEX_REMOTE_PAGES_PROJECT: "from-env" },
      platform: "linux",
    }).args.slice(-2),
    ["--project-name", "from-env"],
  );

  assert.deepEqual(
    buildPagesDeployCommand({ root: "/repo", env: {}, platform: "linux" }).args.slice(-2),
    ["--project-name", "codex-remote-web"],
  );
});

test("runCloudflareDeploy returns the spawned exit status", () => {
  const calls = [];
  const status = runCloudflareDeploy(
    { command: "npx", args: ["wrangler", "deploy"], cwd: "/repo/remote/relay-worker", shell: false },
    {
      spawnSync: (command, args, options) => {
        calls.push({ command, args, options });
        return { status: 7 };
      },
    },
  );

  assert.equal(status, 7);
  assert.equal(calls[0].command, "npx");
  assert.deepEqual(calls[0].args, ["wrangler", "deploy"]);
  assert.equal(calls[0].options.cwd, "/repo/remote/relay-worker");
  assert.equal(calls[0].options.stdio, "inherit");
});
