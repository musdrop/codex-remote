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

test("Windows 托盘菜单提供单独启动远程且菜单项不带省略号", () => {
  const source = readFileSync("native/CodexRemoteTray.cs", "utf8");
  assert.match(source, /AddItem\(m, "启动远程", \(s, e\) => DoEnable\(\)\)/);
  assert.doesNotMatch(source, /AddItem\(m, "[^"]*…"/);
});

test("Windows 托盘声明 DPI aware 并使用 UI 字体", () => {
  const source = readFileSync("native/CodexRemoteTray.cs", "utf8");
  assert.match(source, /SetProcessDPIAware\(\)/);
  assert.match(source, /AutoScaleMode = AutoScaleMode\.Dpi/);
  assert.match(source, /new Font\("Microsoft YaHei UI"/);
});

test("Windows 托盘窗口留出 DPI 后的内容空间", () => {
  const source = readFileSync("native/CodexRemoteTray.cs", "utf8");
  assert.match(source, /MakeWindow\("扫码配对 Codex Remote", 480, 700\)/);
  assert.match(source, /MakeWindow\("Codex Remote 设置", 640, 430\)/);
  assert.match(source, /MakeWindow\("已配对设备", 480, 500\)/);
  assert.match(source, /MakeWindow\("通知设置", 480, 480\)/);
  assert.match(source, /Text = "复制配对链接"/);
  assert.doesNotMatch(source, /MiddleTruncate\(LinkForDisplay\(url\), 44\)/);
});
