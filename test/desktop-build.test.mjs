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
  assert.doesNotMatch(script, /README\.md/);
});

test("Windows desktop build creates a self-contained C# installer from the staging app", () => {
  assert.match(script, /\$AppStageRoot/);
  assert.match(script, /\$InstallerOutputRoot/);
  assert.match(script, /Assert-NodeRuntime/);
  assert.match(script, /Node\.js 24/);
  assert.match(script, /Stop-StagedRuntime/);
  assert.match(script, /Compress-Archive/);
  assert.match(script, /CodexRemoteSetup\.cs/);
  assert.match(script, /CodexRemoteUninstall\.cs/);
  assert.match(script, /CodexRemotePayload\.zip/);
  assert.match(script, /\/resource:\$PayloadZip,CodexRemotePayload\.zip/);
  assert.doesNotMatch(script, /ISCC\.exe/);
  assert.doesNotMatch(script, /CodexRemote\.iss/);
  assert.doesNotMatch(script, /Start-CodexRemote\.cmd/);
});

test("Windows setup allows custom install path and creates normal shortcuts", () => {
  const setup = readFileSync(new URL("../native/CodexRemoteSetup.cs", import.meta.url), "utf8");
  assert.match(setup, /ResolveInstallRoot/);
  assert.match(setup, /Path\.GetFileName\(full\.TrimEnd/);
  assert.match(setup, /FolderBrowserDialog/);
  assert.match(setup, /LocalApplicationData/);
  assert.match(setup, /Programs/);
  assert.match(setup, /Codex Remote/);
  assert.match(setup, /CreateShortcut\(DesktopShortcutPath/);
  assert.match(setup, /CreateShortcut\(StartMenuShortcutPath/);
  assert.match(setup, /CodexRemoteTray\.exe/);
});

test("Windows setup reserves app/resources/icon.ico for exe and shortcut icons", () => {
  const setup = readFileSync(new URL("../native/CodexRemoteSetup.cs", import.meta.url), "utf8");
  assert.match(setup, /AppIconPath/);
  assert.match(setup, /Path\.Combine\(installDir, "app", "resources", "icon\.ico"\)/);
  assert.match(setup, /IconLocation/);
  assert.match(script, /app\\resources\\icon\.ico/);
  assert.match(script, /Copy-FileRelative "app\\resources\\icon\.ico"/);
  assert.match(script, /\/win32icon:\$IconFile/);
});

test("Windows setup writes HKCU uninstall metadata for the bundled uninstaller", () => {
  const setup = readFileSync(new URL("../native/CodexRemoteSetup.cs", import.meta.url), "utf8");
  assert.match(setup, /CurrentUser\.CreateSubKey/);
  assert.match(setup, /CurrentVersion\\+Uninstall\\+CodexRemote/);
  assert.match(setup, /CodexRemoteUninstall\.exe/);
});

test("Windows uninstaller stops remote daemon and removes shortcuts", () => {
  const uninstaller = readFileSync(new URL("../native/CodexRemoteUninstall.cs", import.meta.url), "utf8");
  assert.match(uninstaller, /remote-backend\.mjs/);
  assert.match(uninstaller, /disable/);
  assert.match(uninstaller, /DeleteShortcut\(DesktopShortcutPath/);
  assert.match(uninstaller, /DeleteShortcut\(StartMenuShortcutPath/);
  assert.match(uninstaller, /CurrentUser\.DeleteSubKeyTree/);
});
