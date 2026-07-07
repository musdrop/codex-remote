import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package scripts only expose the Windows desktop build, not web or worker builds", () => {
  assert.equal(pkg.scripts.build, "npm run build:desktop:win");
  assert.equal(pkg.scripts["build:desktop:win"], "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-desktop-win.ps1");
  assert.equal(Object.hasOwn(pkg.scripts, "build:web"), false);
  assert.equal(Object.hasOwn(pkg.scripts, "build:worker"), false);
});

test("package scripts expose separate and combined Cloudflare deployments", () => {
  assert.equal(pkg.scripts["deploy:worker"], "node scripts/deploy-worker.mjs");
  assert.equal(pkg.scripts["deploy:web"], "node scripts/deploy-web.mjs");
  assert.equal(pkg.scripts.deploy, "node scripts/deploy-all.mjs");
});

test("package scripts expose a tag-based release command", () => {
  assert.equal(pkg.scripts.release, "node scripts/release.mjs");
});
