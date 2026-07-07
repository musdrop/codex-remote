#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

import { resolveTargetVersion } from "./lib/release/versioning.mjs";

const packageJsonPath = new URL("../package.json", import.meta.url);

function main() {
  const { requestedVersion, dryRun } = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const target = resolveTargetVersion({
    currentVersion: pkg.version,
    requestedVersion,
  });

  if (dryRun) {
    console.log(`将发布 ${target.tag}，package.json 版本会从 ${pkg.version} 更新为 ${target.version}。`);
    return;
  }

  ensureCleanWorkingTree();
  ensureTagDoesNotExist(target.tag);

  pkg.version = target.version;
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  run("git", ["add", "package.json"]);
  run("git", ["commit", "-m", `chore: release ${target.tag}`]);
  run("git", ["tag", "-a", target.tag, "-m", `Release ${target.tag}`]);
  run("git", ["push", "origin", "HEAD", "--follow-tags"]);

  console.log(`已推送 ${target.tag}。GitHub Actions 将构建安装包并创建 Release。`);
}

function parseArgs(argv) {
  let requestedVersion;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (requestedVersion) {
      throw new Error("Only one release version can be provided.");
    }
    requestedVersion = arg;
  }

  return { requestedVersion, dryRun };
}

function ensureCleanWorkingTree() {
  const result = run("git", ["status", "--porcelain"], { capture: true });
  if (result.stdout.trim()) {
    throw new Error("Working tree must be clean before releasing. Commit or stash current changes first.");
  }
}

function ensureTagDoesNotExist(tag) {
  const result = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0) {
    throw new Error(`Tag ${tag} already exists.`);
  }
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
  }
  return result;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
