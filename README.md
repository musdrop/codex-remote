# Codex Remote

Codex Remote 是一个独立的 Codex 远程控制项目。它不打包、修改或替换官方 Codex App，而是在用户已安装官方 Codex 的基础上提供远程查看、接管和控制能力。

目标是：用户已经安装官方 Codex 后，启动本项目的桌面 daemon，再用浏览器网页扫码/打开配对链接，即可在手机或其他浏览器中查看、接管和控制本机 Codex 会话。

## 架构

```text
浏览器前端 remote/web
  |
  | wss，端到端加密信封
  v
Relay 中转 remote/relay-worker 或 remote/relay-node
  |
  | 只按 daemonId 转发密文
  v
桌面 daemon remote/daemon
  |
  | ws://127.0.0.1:<port> JSON-RPC
  v
官方 codex app-server
  |
  v
用户的 CODEX_HOME 会话数据，默认 ~/.codex
```

三端的关系由配对链接建立。daemon 生成配对链接时，会把 `relayUrl`、`daemonId`、daemon 公钥、电脑名和一次性配对令牌写进 URL hash。前端解析后连接 relay，relay 再按 `daemonId` 找到对应的桌面 daemon。

relay 不知道设备令牌、配对令牌或会话内容；业务鉴权和端到端加密都发生在前端与 daemon 之间。

## 目录

| 路径 | 说明 |
| --- | --- |
| `remote/daemon` | 桌面端守护进程，启动并代理官方 `codex app-server`。 |
| `remote/web` | 浏览器/PWA 前端，静态文件，无构建步骤。 |
| `remote/relay-worker` | Cloudflare Worker + Durable Objects relay，适合正式部署。 |
| `remote/relay-node` | 零依赖 Node relay，适合本地开发或自托管。 |
| `launcher/` | 桌面托盘/菜单壳可复用的远程后端命令层。 |
| `src/desktop` | 独立项目新增的官方 Codex CLI 查找与启动参数解析。 |

## 前置条件

- Node.js 20 或更新版本。
- 已安装官方 Codex，并能在本机运行 `codex app-server`。
- `codex` 在 `PATH` 中，或启动 daemon 时通过 `--codex` 指定可执行文件路径。
- Windows 官方桌面 App 的 `app\Codex.exe` 是桌面壳；真正的 CLI 通常在 `app\resources\codex.exe`。本项目会自动把前者映射到后者。
- 真机手机访问时，前端必须部署到 HTTPS 地址，relay 必须是公网可访问的 `wss://` 地址。

## 本地开发启动

本地开发适合在同一台电脑的浏览器里验证链路。若要用真实手机扫码，请看后面的正式部署，因为手机无法访问电脑上的 `127.0.0.1` relay。

这些 `remote:*` 命令是开发调试入口，不是最终用户的桌面启动界面。桌面托盘入口见后文“桌面端便携目录”。

1. 启动本地 relay：

   ```powershell
   npm run remote:relay
   ```

   默认地址是：

   ```text
   ws://127.0.0.1:8787
   ```

2. 启动前端静态服务。可以使用任意静态服务器，例如：

   ```powershell
   python -m http.server 4173 -d remote/web
   ```

   前端地址是：

   ```text
   http://127.0.0.1:4173/
   ```

3. 启动桌面 daemon。若 `codex` 不在 `PATH`，用 `--codex` 指定官方 Codex CLI 路径：

   ```powershell
   npm run remote:daemon -- --codex "C:\Path\To\codex.exe" --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
   ```

   npm 11 在部分环境里会把 `--codex`、`--relay`、`--web` 当作 npm 自己的配置项处理，并把值作为位置参数传给脚本。本项目兼容这种形式，也可以直接写成：

   ```powershell
   npm run remote:daemon -- "C:\Path\To\codex.exe" ws://127.0.0.1:8787 http://127.0.0.1:4173/
   ```

   或绕过 npm，直接调用 Node：

   ```powershell
   node scripts/start-daemon.mjs --codex "C:\Path\To\codex.exe" --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
   ```

   如果 `codex` 已在 `PATH` 中，可以省略 `--codex`：

   ```powershell
   npm run remote:daemon -- --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
   ```

4. 生成配对链接：

   ```powershell
   npm run remote:pair
   ```

5. 在浏览器中打开输出的配对链接。配对成功后，前端会保存设备令牌，后续可直接重连。

## 正式部署

正式使用时通常需要三部分：公网 relay、HTTPS 前端、用户电脑上的 daemon。

### 1. 部署 relay

推荐使用 Cloudflare Worker：

```powershell
cd remote/relay-worker
npx wrangler login
npx wrangler deploy
```

也可以在项目根目录直接执行：

```powershell
npm run deploy:worker
```

[remote/relay-worker/wrangler.toml](remote/relay-worker/wrangler.toml) 默认不绑定任何生产域名。若要使用自定义域名，可以在 Cloudflare 控制台绑定，或把里面的示例路由改成自己的域名：

```toml
routes = [{ pattern = "relay.example.com/*", zone_name = "example.com" }]
```

部署完成后，daemon 使用：

```text
wss://relay.example.com
```

本地或自托管也可以使用 Node relay：

```powershell
node remote/relay-node/server.mjs --host 0.0.0.0 --port 8787
```

生产环境要在它前面放 TLS 反向代理，并让 daemon 使用 `wss://你的域名`。

### 2. 部署前端

`remote/web` 是纯静态前端，可以部署到任意 HTTPS 静态站：

- GitHub Pages
- Cloudflare Pages
- Nginx 静态目录
- 对象存储静态站点

前端本身不需要写死 relay 地址。relay 地址来自 daemon 生成的配对链接。

部署到 Cloudflare Pages：

```powershell
npm run deploy:web -- --project-name codex-remote-web
```

如果设置了环境变量，也可以省略参数：

```powershell
$env:CODEX_REMOTE_PAGES_PROJECT="codex-remote-web"
npm run deploy:web
```

Worker 与 Pages 一起部署：

```powershell
npm run deploy -- --project-name codex-remote-web
```

这些命令不构建 web 或 worker，只是调用 Wrangler 部署现有目录。

假设前端部署后地址是：

```text
https://remote.example.com/
```

启动 daemon 时传给 `--web`，之后生成的配对链接就会指向这个前端：

```powershell
npm run remote:daemon -- --relay wss://relay.example.com --web https://remote.example.com/
```

### 3. 启动桌面 daemon

桌面 daemon 运行在用户电脑上，负责：

- 启动官方 `codex app-server`。
- 连接公网 relay。
- 管理配对设备、设备令牌、围观链接和通知配置。
- 读取与官方 Codex 相同的 `CODEX_HOME` 会话数据。
- 把前端请求代理到 `codex app-server`。

常用启动命令：

```powershell
npm run remote:daemon -- --codex "C:\Path\To\codex.exe" --relay wss://relay.example.com --web https://remote.example.com/
```

如果 npm 提示 `Unknown cli config "--codex"`，请改用位置参数形式：

```powershell
npm run remote:daemon -- "C:\Path\To\codex.exe" wss://relay.example.com https://remote.example.com/
```

可选参数：

| 参数/环境变量 | 说明 |
| --- | --- |
| `--codex <path>` | 指定官方 Codex CLI 路径。 |
| `CODEX_REMOTE_CODEX` | 也可用环境变量指定官方 Codex CLI。 |
| `--relay <url>` | 指定 relay 地址，正式环境应为 `wss://...`。 |
| `--web <url>` | 指定前端地址，用于生成配对链接和通知深链。 |
| `--config <path>` | 指定 daemon 配置文件路径。 |
| `--no-prevent-sleep` | 关闭“设备在线或任务运行时阻止睡眠”。 |
| `CODEX_HOME` | 指定官方 Codex 会话与配置目录；不设置时使用官方默认目录。 |

当前默认 daemon 配置文件：

```text
~/.codex-remote/remote/daemon.json
```

首次启动会自动生成。`--relay`、`--web`、`--codex` 会写入该配置，后续可以不重复传。如果检测到旧版本配置，新版本会在首次使用默认路径时迁移一份到新目录。

## 桌面端便携目录

Windows 桌面端现在支持构建便携目录。它会产出一个可直接复制到用户电脑上的文件夹，里面包含：

- `CodexRemoteTray.exe`：托盘程序。
- `Start-CodexRemote.cmd`：双击启动托盘。
- `node/node.exe`：随包携带的 Node 运行时。
- `config/product.json`：发布者配置，写入你部署好的 relay 与网页地址。
- `launcher/`、`remote/daemon/src/`、`src/desktop/`：托盘后端、daemon 与必要工具代码。

构建前先编辑：

```text
config/product.json
```

示例：

```json
{
  "relayUrl": "wss://relay.example.com",
  "webUrl": "https://remote.example.com/"
}
```

这两个地址属于发布者配置，会被复制进便携目录。普通用户在托盘设置里只能查看，不能修改。

构建命令：

```powershell
npm run build:desktop:win
```

输出目录：

```text
dist/desktop/windows/CodexRemote
```

运行方式：

```powershell
dist\desktop\windows\CodexRemote\Start-CodexRemote.cmd
```

启动后会出现系统托盘图标。右键托盘图标可以：

- 查看远程是否启用/运行。
- 设置 Codex CLI 路径。
- 启动远程。
- 扫码配对手机。
- 查看和撤销已配对设备。
- 配置通知渠道。
- 停用远程。
- 退出并停止远程。

已有手机配对时，可以只点“启动远程”让网页重新连上这台电脑；需要新设备配对时，再点“扫码配对手机”。这两个入口都会在必要时启用 daemon。独立版不会使用内置 Codex，而是查找用户机器上的官方 Codex CLI：

- 优先使用环境变量 `CODEX_REMOTE_CODEX`。
- 其次复用 daemon 配置中的 `codexCommand`。
- 最后从 `PATH` 查找 `codex.exe`。

如果找不到官方 Codex CLI，托盘会弹出后端返回的错误并打开“设置…”窗口。用户可以点击“自动检测”，也可以手动选择官方 Codex 安装目录里的 `app\resources\codex.exe`。保存后会写入用户配置：

```text
%USERPROFILE%\.codex-remote\remote\daemon.json
```

托盘里的“停用远程”和“退出并停止远程”都会停止 Windows 计划任务，并兜底终止当前便携目录/源码目录下残留的 daemon 进程树；退出托盘不会让远程服务继续在后台运行。

开发态也可以直接启动托盘：

```powershell
npm run desktop:win:dev
```

这个命令会编译 `native/CodexRemoteTray.cs`，然后用当前源码目录里的 `launcher/win/remote-backend.mjs` 启动托盘，适合边改边测。
再次运行时，它会先结束当前源码目录里的旧托盘实例，再重新编译和启动，避免开发时误用旧进程。

### 开发态连接排查

如果便携目录能正常连接，但 `npm run desktop:win:dev` 打开的网页提示无法连接电脑，先按下面顺序排查：

1. 确认开发后端生成的配对链接是否正确：

   ```powershell
   node launcher\win\remote-backend.mjs pair
   ```

   输出的链接应该以你的线上前端开头，例如 `https://remote.example.com/#d=...`。其中 hash 里会携带 relay 地址。

2. 确认 relay 能看到这台电脑。浏览器前端连接的路径形如：

   ```text
   wss://relay.example.com/v1/client/<daemonId>
   ```

   若 daemon 正常在线，浏览器应能建立 WebSocket 并完成鉴权。

3. 如果控制台出现 `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT`，这通常不是 Worker 或 daemon 返回的错误，而是当前浏览器的扩展、广告拦截、隐私防护或安全软件拦截了某个资源或 WebSocket。请用无痕窗口、禁用扩展，或换一个浏览器打开新生成的配对链接再试。

4. 如果无痕窗口可用，而普通窗口不可用，清理前端站点数据后重新扫码：

   ```text
   localStorage: czr-daemons / czr-active / czr-client / czr-last
   service worker cache: codex-remote-shell-v1
   ```

5. 如果仍然连不上，请在浏览器 DevTools 的 Network 面板里点开失败请求，把被拦截的完整 URL 复制出来。只看到 `ERR_BLOCKED_BY_CLIENT` 不足以判断是静态资源、Service Worker，还是 WebSocket 被拦截。

## 构建桌面便携目录

```powershell
npm run build
```

该命令等价于：

```powershell
npm run build:desktop:win
```

输出：

```text
dist/desktop/windows/CodexRemote
```

前端和 Worker 不需要额外构建：

- 前端直接部署 `remote/web` 目录。
- Cloudflare Worker 直接在 `remote/relay-worker` 目录执行 `npx wrangler deploy`。
- Windows 桌面便携目录只打包运行 daemon 所需的文件，不包含 `remote/web`、`remote/relay-worker`、`remote/relay-node`。

也可以使用项目根目录的部署脚本：

```powershell
npm run deploy:worker
npm run deploy:web -- --project-name codex-remote-web
npm run deploy -- --project-name codex-remote-web
```

## 配置如何关联三端

最关键的是 daemon 配置里的两个 URL：

```json
{
  "relayUrl": "wss://relay.example.com",
  "webUrl": "https://remote.example.com/",
  "codexCommand": "C:\\Path\\To\\codex.exe"
}
```

生成配对链接时：

- `webUrl` 决定链接打开哪个前端页面。
- `relayUrl` 被写进 URL hash，前端据此连接 relay。
- `daemonId` 被写进 URL hash，relay 据此把前端连接转给对应电脑。
- daemon 公钥被写进 URL hash，前端据此建立端到端加密会话。
- 一次性 `pairToken` 被写进 URL hash，只用于首次换取长期设备令牌。

因此，前端部署后不需要单独配置 relay；真正的连接信息都由 daemon 生成的配对链接携带。

## 可保留能力

- 扫码/链接配对。
- 多设备连接。
- 端到端加密 relay 转发。
- 会话列表和历史查看。
- 实时查看官方 Codex 或 daemon 正在写入的会话。
- 通过 daemon 发送消息、新建会话、继续会话。
- daemon 发起任务的远程审批与停止。
- 图片上传与会话图片分块查看。
- 围观只读链接。
- webhook 通知。
- 设备在线或任务运行时防睡眠。

## 第一版边界

本项目第一版不修改官方 Codex，因此：

- 官方 Codex 桌面 UI 可能不会自动显示远程发送的新消息，需要手动刷新或重新打开会话。
- 官方桌面 UI 自己启动的任务，其审批和停止不保证能被独立 daemon 接管。
- 不做中文化、Browser/Computer Use gate 修改、官方 App 页面按钮注入。

## 通知配置

通知由 daemon 主动调用 webhook，内容只包含事件类型与会话名，不包含命令原文或代码。

```powershell
node remote/daemon/src/main.mjs notify --add bark --key <BarkKey>
node remote/daemon/src/main.mjs notify --add serverchan --key <Server酱Key>
node remote/daemon/src/main.mjs notify --add wecom --url <企业微信机器人URL>
node remote/daemon/src/main.mjs notify --add dingtalk --url <钉钉机器人URL>
node remote/daemon/src/main.mjs notify --add custom --url <自定义Webhook>
node remote/daemon/src/main.mjs notify --list
node remote/daemon/src/main.mjs notify --test
```

## 测试

```powershell
npm test
```
