import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Windows 托盘退出会先停用远程 daemon", () => {
  const source = readFileSync("native/CodexRemoteTray.cs", "utf8");
  assert.match(
    source,
    /void DoQuit\(\)[\s\S]*Backend\.Call\("disable"\)[\s\S]*ExitThread\(\)/,
  );
});
