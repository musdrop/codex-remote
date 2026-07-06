import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../scripts/build-desktop-win.ps1", import.meta.url), "utf8");

test("Windows desktop build copies only runtime slices instead of the whole remote tree", () => {
  assert.match(script, /config\\product\.json/);
  assert.match(script, /remote\\daemon\\src/);
  assert.doesNotMatch(script, /foreach \(\$dir in @\("remote", "launcher", "src"\)\)/);
  assert.doesNotMatch(script, /remote\\web/);
  assert.doesNotMatch(script, /remote\\relay-worker/);
  assert.doesNotMatch(script, /remote\\relay-node/);
});
