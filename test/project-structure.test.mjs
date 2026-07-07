import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("project helper modules live under scripts/lib instead of top-level src", () => {
  assert.equal(existsSync("src"), false);
  assert.equal(existsSync("scripts/lib/desktop/codex-command.mjs"), true);
  assert.equal(existsSync("scripts/lib/desktop/product-config.mjs"), true);
  assert.equal(existsSync("scripts/lib/desktop/start-options.mjs"), true);
  assert.equal(existsSync("scripts/lib/deploy/cloudflare.mjs"), true);
  assert.equal(existsSync("scripts/lib/codex-home.mjs"), true);
});

test("Windows desktop build stages scripts/lib rather than src/desktop", () => {
  const script = readFileSync("scripts/build-desktop-win.ps1", "utf8");
  assert.match(script, /scripts\\lib\\desktop\\codex-command\.mjs/);
  assert.match(script, /scripts\\lib\\desktop\\product-config\.mjs/);
  assert.doesNotMatch(script, /src\\desktop/);
});

test("top-level scripts import helper modules through local ./lib paths", () => {
  for (const file of [
    "scripts/start-daemon.mjs",
    "scripts/deploy-all.mjs",
    "scripts/deploy-web.mjs",
    "scripts/deploy-worker.mjs",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\.\.\/scripts\/lib/);
    assert.match(source, /\.\/lib\//);
  }
});
