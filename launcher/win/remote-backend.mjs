// Windows (Scheduled Task) backend for the tray Remote controller (CodexRemoteTray.cs).
//
// Same argv-in / single-JSON-out protocol as the macOS backend. The cross-platform
// command surface lives in ../remote-backend-core.mjs; this file only supplies the
// Windows keepalive layer (schtasks + task XML) and, on pair/pair-once, renders a
// QR bitmap so the C# tray stays a thin image viewer.
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadOrCreateConfig, saveConfig, defaultConfigPath } from "../../remote/daemon/src/config.mjs";
import { run as coreRun } from "../remote-backend-core.mjs";
import { writeQrBmp } from "./qr-bmp.mjs";
import { resolveCodexCommand } from "../../src/desktop/codex-command.mjs";
import { loadProductConfig } from "../../src/desktop/product-config.mjs";

export const TASK_NAME = "CodexRemote";
export const LEGACY_TASK_NAMES = ["Codex" + "ZhRemote"];
const APP_SERVER_PORT = 19271; // daemon 拉起的 codex app-server；连得上=app-server 在跑

// —— install 内路径解析（backend 位于 <install>\launcher\win）——
export function resolveInstallRoot(env = process.env, moduleUrl = import.meta.url) {
  if (env.CODEX_REMOTE_APP_ROOT) return env.CODEX_REMOTE_APP_ROOT;
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..");
}

export function installPaths(root) {
  // 显式用 win32.join：这些按定义是 Windows install 路径，写死反斜杠保证在 Mac 上跑
  // 单测也得到确定结果（与 mac 后端用 posix.join 同理）。
  const j = path.win32.join;
  const opts = typeof arguments[1] === "object" && arguments[1] ? arguments[1] : {};
  return {
    node: opts.nodePath || j(root, "node", "node.exe"),
    codexExe: opts.codexCommand || "codex",
    daemonMain: j(root, "remote", "daemon", "src", "main.mjs"),
    hiddenLauncher: j(root, "launcher", "win", "run-hidden.vbs"),
    workingDir: root,
  };
}

function escapeXml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

// 计划任务 XML：当前用户登录触发 + 失败自动重启（对齐 Mac launchd RunAtLoad+KeepAlive），
// 隐藏、最小权限、无执行时限（daemon 常驻）。
// 动作＝无窗口的 wscript 承载 run-hidden.vbs：以隐藏窗口启动 bundled node 跑 main.mjs start
// 并等待——既不弹控制台黑窗，又让计划任务能跟踪进程、触发 RestartOnFailure 崩溃自愈。
export function buildTaskXml({ node, daemonMain, workingDir, userId, vbs }) {
  const args = `"${vbs}" "${node}" "${daemonMain}" "${workingDir}"`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Codex Remote 远程守护进程</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>${escapeXml(userId)}</UserId>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${escapeXml(userId)}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>wscript.exe</Command>
      <Arguments>${escapeXml(args)}</Arguments>
      <WorkingDirectory>${escapeXml(workingDir)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

// 当前用户的账户名（authority\user）。用 whoami 的输出——那是 OS 自己认的名字，
// 一定能映射到 SID；env USERDOMAIN 在工作组机器上是 "WORKGROUP"，schtasks 会报
// 「账户名与 SID 无映射」。whoami 不可用时退回 COMPUTERNAME\USERNAME。
export function currentUserId() {
  try {
    const r = spawnSync("whoami", [], { encoding: "utf8" });
    const s = (r.stdout || "").trim();
    if (r.status === 0 && s.includes("\\")) return s;
  } catch {
    // 退回环境变量
  }
  const authority = process.env.COMPUTERNAME || process.env.USERDOMAIN || ".";
  return `${authority}\\${process.env.USERNAME || "user"}`;
}

// 同步探测 app-server 端口是否在监听（与语言无关，比解析 schtasks 本地化状态文本可靠）。
function probePortSync(port) {
  const script = `const s=require("net").connect(${port},"127.0.0.1");s.setTimeout(1200);s.on("connect",()=>{s.destroy();process.exit(0)});s.on("error",()=>process.exit(1));s.on("timeout",()=>process.exit(1));`;
  const res = spawnSync(process.execPath, ["-e", script], { timeout: 3000 });
  return res.status === 0;
}

// —— makeDeps：core 依赖 + 注入 schtasks 版平台钩子 ——
export function makeDeps(overrides = {}) {
  const home = overrides.homeDir || homedir();
  const installRoot = overrides.installRoot || resolveInstallRoot();
  return {
    configPath: overrides.configPath || defaultConfigPath(),
    installRoot,
    productConfig: overrides.productConfig || loadProductConfig(installRoot),
    homeDir: home,
    nodePath: overrides.nodePath || process.execPath,
    resolveCodex: overrides.resolveCodex || ((opts = {}) => resolveCodexCommand(opts)),
    userId: overrides.userId || currentUserId(),
    runSchtasks: overrides.runSchtasks || ((args) => spawnSync("schtasks", args, { encoding: "utf8" })),
    listProcesses: overrides.listProcesses || listWindowsProcesses,
    killProcessTree: overrides.killProcessTree || ((pid) => spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { encoding: "utf8" })),
    probePort: overrides.probePort || (() => probePortSync(APP_SERVER_PORT)),
    fetch: overrides.fetch || globalThis.fetch,
    log: overrides.log || (() => {}),
    now: overrides.now || (() => Date.now()),
    isEnabled,
    isRunning,
    enable,
    disable,
    ...overrides,
  };
}

export function isEnabled(deps) {
  const res = deps.runSchtasks(["/Query", "/TN", TASK_NAME]);
  return res.status === 0;
}

export function isRunning(deps) {
  return deps.probePort();
}

export function enable(deps) {
  const config = loadOrCreateConfig(deps.configPath, { productConfig: deps.productConfig });
  let codex;
  try {
    codex = deps.resolveCodex({
      env: {
        ...process.env,
        CODEX_REMOTE_CODEX:
          process.env.CODEX_REMOTE_CODEX ||
          deps.codexCommand ||
          (config.codexCommand && config.codexCommand !== "codex" ? config.codexCommand : ""),
      },
      platform: "win32",
    });
  } catch (err) {
    return {
      ok: false,
      enabled: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const p = installPaths(deps.installRoot, {
    nodePath: deps.nodePath,
    codexCommand: codex.command,
  });
  // daemon 配置：codexCommand 钉到用户机器上的官方 Codex Desktop 内置 Codex CLI（含空格路径 Node spawn 已验证 OK）
  config.codexCommand = p.codexExe;
  if (deps.productConfig?.relayUrl) config.relayUrl = deps.productConfig.relayUrl;
  if (deps.productConfig?.webUrl) config.webUrl = deps.productConfig.webUrl;
  saveConfig(deps.configPath, config);

  const xml = buildTaskXml({ node: p.node, daemonMain: p.daemonMain, workingDir: p.workingDir, userId: deps.userId, vbs: p.hiddenLauncher });
  const xmlPath = path.join(path.dirname(deps.configPath), "remote-task.xml");
  mkdirSync(path.dirname(xmlPath), { recursive: true });
  // schtasks /XML 需 UTF-16LE + BOM，否则报「任务 XML 格式错误」
  writeFileSync(xmlPath, `﻿${xml}`, "utf16le");

  cleanupLegacyTasks(deps);
  const created = deps.runSchtasks(["/Create", "/TN", TASK_NAME, "/XML", xmlPath, "/F"]);
  if (created.status !== 0) {
    const msg = String(created.stderr || created.stdout || "schtasks 创建计划任务失败").trim();
    deps.log(`schtasks create: ${msg}`);
    return { ok: false, enabled: false, error: msg };
  }
  deps.runSchtasks(["/Run", "/TN", TASK_NAME]); // 立即拉起（对齐 RunAtLoad）
  return { ok: true, enabled: true };
}

export function disable(deps) {
  deps.runSchtasks(["/End", "/TN", TASK_NAME]); // 停当前实例，忽略失败
  deps.runSchtasks(["/Delete", "/TN", TASK_NAME, "/F"]);
  cleanupLegacyTasks(deps);
  stopInstallDaemons(deps);
  return { ok: true, enabled: false };
}

function cleanupLegacyTasks(deps) {
  for (const name of LEGACY_TASK_NAMES) {
    deps.runSchtasks(["/End", "/TN", name]);
    deps.runSchtasks(["/Delete", "/TN", name, "/F"]);
  }
}

function listWindowsProcesses() {
  const script = [
    "Get-CimInstance Win32_Process",
    "| Select-Object ProcessId,ParentProcessId,Name,CommandLine",
    "| ConvertTo-Json -Compress",
  ].join(" ");
  const res = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8", timeout: 10_000 });
  if (res.status !== 0 || !res.stdout.trim()) return [];
  try {
    const parsed = JSON.parse(res.stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function stopInstallDaemons(deps) {
  const daemonMain = normalizeProcessPath(installPaths(deps.installRoot, { nodePath: deps.nodePath }).daemonMain);
  for (const proc of deps.listProcesses()) {
    const rawCommandLine = proc.commandLine ?? proc.CommandLine ?? "";
    const commandLine = normalizeProcessPath(rawCommandLine);
    if (!commandLine.includes(daemonMain)) continue;
    if (!/\bstart\b/i.test(rawCommandLine)) continue;
    const pid = Number(proc.processId ?? proc.ProcessId);
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
    deps.killProcessTree(pid);
  }
}

function normalizeProcessPath(value) {
  return String(value).replace(/\//g, "\\").toLowerCase();
}

// pair/pair-once 额外渲染二维码 BMP，路径回给托盘显示；其余命令原样走 core。
export async function run(command, rest, deps) {
  if (command === "pair" || command === "pair-once") {
    const r = await coreRun(command, rest, deps);
    if (r && r.url && !r.error) {
      try {
        r.qrPath = writeQrBmp(r.url, path.join(tmpdir(), `codex-remote-qr-${process.pid}.bmp`));
      } catch (err) {
        deps.log(`qr 生成失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return r;
  }
  return coreRun(command, rest, deps);
}

const isDirectRun = process.argv[1] && path.basename(process.argv[1]) === "remote-backend.mjs";
if (isDirectRun) {
  const [command, ...rest] = process.argv.slice(2);
  run(command, rest, makeDeps())
    .then((result) => process.stdout.write(JSON.stringify(result)))
    .catch((err) => {
      process.stdout.write(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      process.exit(1);
    });
}
