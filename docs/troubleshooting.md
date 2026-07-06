# 排障指南

本文记录常见问题的定位路径。

## 生成的链接打不开或无法连接电脑

先确认 daemon 生成的配对链接是否正确：

```powershell
node launcher\win\remote-backend.mjs pair
```

输出链接应该以你的线上前端开头，例如：

```text
https://remote.example.com/#d=...
```

链接 hash 中会携带 relay 地址、daemonId、公钥和设备令牌。

## 浏览器报 ERR_BLOCKED_BY_CLIENT

如果控制台出现：

```text
Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
```

这通常不是 Worker 或 daemon 返回的错误，而是当前浏览器的扩展、广告拦截、隐私防护或安全软件拦截了某个资源或 WebSocket。

建议：

1. 用无痕窗口打开新生成的配对链接。
2. 临时禁用广告拦截或隐私类扩展。
3. 换一个浏览器测试。
4. 在 DevTools 的 Network 面板里点开失败请求，确认被拦截的完整 URL。

只看到 `ERR_BLOCKED_BY_CLIENT` 不足以判断是静态资源、Service Worker，还是 WebSocket 被拦截。

## 普通窗口不可用，无痕窗口可用

清理前端站点数据后重新扫码：

```text
localStorage: czr-daemons / czr-active / czr-client / czr-last
service worker cache: codex-remote-shell-v1
```

## 托盘显示停用，但手机仍能连接

这通常表示有残留 daemon 进程仍在后台运行。先执行：

```powershell
node launcher\win\remote-backend.mjs status
```

如果返回 `enabled:false` 但 `running:true`，执行：

```powershell
node launcher\win\remote-backend.mjs disable
```

新版 Windows 后端会在停用时兜底清理当前便携目录/源码目录下的 daemon 进程树。

## app-server 端口被占用

默认端口是 `19271`。如果已被占用，daemon 会自动尝试下一个可用端口，例如 `19272`。

日志中可能看到：

```text
app-server 端口 19271 已被占用，改用 19272
```

这是正常行为。

## 找不到 Codex Desktop 内置 Codex CLI

错误示例：

```text
未找到可用的 Codex Desktop 内置 Codex CLI
```

处理方式：

1. 确认官方 Codex Desktop 已安装。
2. 优先选择官方安装目录中的 `app\resources\codex.exe`。
3. 在托盘“设置”窗口保存路径。
4. 或设置环境变量 `CODEX_REMOTE_CODEX`。

Windows 官方桌面 App 的 `app\Codex.exe` 是桌面壳。项目会尽量自动映射到 `app\resources\codex.exe`，但自动检测失败时应手动选择该文件。

不要选择 npm 全局安装生成的 `codex.cmd`。新版自动检测会跳过 `.cmd/.ps1` shim，并对真实 `codex.exe` 运行 `app-server --help` 探测，确认可用后才写入配置。

## 查看配置文件

默认 daemon 配置：

```text
%USERPROFILE%\.codex-remote\remote\daemon.json
```

默认日志目录与配置文件同目录。Windows 计划任务启动的 daemon 会把日志写入：

```text
%USERPROFILE%\.codex-remote\remote\daemon.log
```

## 开发态托盘用错旧进程

运行：

```powershell
npm run desktop:win:dev
```

该命令会先结束当前源码目录里的旧托盘实例，再重新编译和启动。如果仍怀疑有旧进程，查看：

```powershell
Get-Process CodexRemoteTray -ErrorAction SilentlyContinue
```

## relay 是否能看到电脑

浏览器前端连接路径形如：

```text
wss://relay.example.com/v1/client/<daemonId>
```

如果 daemon 正常在线，浏览器应能建立 WebSocket 并完成鉴权。若前端一直显示电脑离线，优先检查：

- daemon 是否运行。
- `relayUrl` 是否为公网 `wss://` 地址。
- Worker 域名是否正确绑定。
- 浏览器或安全软件是否拦截 WebSocket。
