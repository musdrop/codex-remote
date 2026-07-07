# Codex Remote

Codex Remote 是一个独立的 Codex 远程控制项目。它不打包、修改或替换官方 Codex App，而是在用户已安装官方 Codex 的基础上，提供浏览器远程查看、接管和控制能力。

本项目来源于 [focuxdot/codex-zh](https://github.com/focuxdot/codex-zh) 的远程协作子系统抽离与独立化。当前仓库保留并改造了原项目中的 daemon、relay、浏览器前端、配对、端到端加密、围观分享等远程能力；原项目中与 Codex 中文定制安装包、官方 App patch、配置向导等相关的代码不属于本项目目标范围。原始项目地址：[https://github.com/focuxdot/codex-zh](https://github.com/focuxdot/codex-zh)。

典型使用方式是：桌面端运行 Codex Remote daemon，浏览器打开配对链接，通过 relay 与桌面端建立端到端加密连接，然后查看或控制本机 Codex 会话。

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

配对链接会携带 `webUrl`、`relayUrl`、`daemonId`、daemon 公钥和配对令牌。前端不需要预先写死 relay 地址；真正的连接信息由 daemon 生成的配对链接传递。relay 只转发密文，不知道设备令牌、配对令牌或会话内容。

## 目录

| 路径 | 说明 |
| --- | --- |
| `remote/daemon` | 桌面端守护进程，启动并代理官方 `codex app-server`。 |
| `remote/web` | 浏览器/PWA 前端，静态文件，无构建步骤。 |
| `remote/relay-worker` | Cloudflare Worker + Durable Objects relay，适合正式部署。 |
| `remote/relay-node` | 零依赖 Node relay，适合本地开发或自托管。 |
| `launcher/` | 桌面托盘/菜单壳可复用的远程后端命令层。 |
| `native/` | Windows 托盘程序源码与开发启动脚本。 |
| `scripts/lib/desktop` | 官方 Codex Desktop 内置 Codex CLI 查找、产品配置等桌面端辅助逻辑。 |
| `scripts/lib/deploy` | Cloudflare Worker / Pages 部署脚本辅助逻辑。 |
| `docs/` | 开发、部署、桌面端、排障等细节文档。 |

## 前置条件

- Node.js 24 或更新版本。Windows 安装包会复制构建机上的 `node.exe`，daemon 运行时需要 Node 24 提供的全局 `WebSocket`。
- 已安装官方 Codex Desktop，并能在本机运行随包的 `app-server`。
- 能提供官方 Codex Desktop 安装目录里的 `app\resources\codex.exe`。
- Windows 官方桌面 App 的 `app\Codex.exe` 是桌面壳；本项目会自动把它映射到 `app\resources\codex.exe`。
- npm 全局安装产生的 `codex.cmd` 不是桌面端推荐入口，自动检测会跳过这类 shim。
- 真机手机访问时，前端必须部署到 HTTPS 地址，relay 必须是公网可访问的 `wss://` 地址。
- 构建 Windows 安装包需要 Windows 环境中的 C# 编译器。GitHub Actions `windows-latest` 可直接构建。

## 快速开发

本地开发可以直接跑三件事：本地 relay、静态前端、桌面 daemon。

```powershell
npm run remote:relay
python -m http.server 4173 -d remote/web
npm run remote:daemon -- --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
```

如果自动检测不到，给 daemon 传入 Codex Desktop 内置 Codex CLI 路径：

```powershell
npm run remote:daemon -- --codex "C:\Path\To\Codex\app\resources\codex.exe" --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
```

Windows 托盘开发入口：

```powershell
npm run desktop:win:dev
```

注意，该命令构建的桌面托盘程序会加载发布者配置

更多开发命令、npm 参数兼容写法、配对链接生成方式见 [docs/development.md](docs/development.md)。

## 部署概览

正式部署通常分三部分：

1. 部署 relay：`remote/relay-worker` 到 Cloudflare Workers。
2. 部署前端：`remote/web` 到 Cloudflare Pages 或任意 HTTPS 静态站。
3. 构建桌面端：编辑 `config/product.json` 后构建 Windows 安装包。

常用命令：

```powershell
npm run deploy:worker
npm run deploy:web -- --project-name codex-remote-web
npm run build:desktop:win
```

Windows 安装包输出到：

```text
dist/desktop/windows/installer/CodexRemote-Setup-<version>.exe
```

正式发布推荐使用 tag 触发 GitHub Actions：

```powershell
npm run release -- 0.2.0
```

不传版本号时会基于 `package.json` 当前版本自动递增 patch：

```powershell
npm run release
```

该命令会更新 `package.json` 版本、创建发布提交、打 `vX.Y.Z` tag 并推送到 `origin`。GitHub Actions 随后在 Windows runner 上运行测试、构建安装包并创建 GitHub Release。

完整部署流程见 [docs/deployment.md](docs/deployment.md)。Windows 桌面端配置、菜单、构建产物说明见 [docs/desktop-windows.md](docs/desktop-windows.md)。

## 配置要点

发布者配置在：

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

这两个地址会被复制进桌面安装包，普通用户在托盘设置里只读查看，不能修改。

用户侧 daemon 配置默认在：

```text
%USERPROFILE%\.codex-remote\remote\daemon.json
```

其中保存 daemon 身份、设备令牌元数据、通知渠道、Codex Desktop 内置 Codex CLI 路径等本机状态。

## 能力边界

支持：

- 扫码/链接配对，多设备连接。
- 端到端加密 relay 转发。
- 会话列表、历史和运行中会话实时查看。
- 通过 daemon 发送消息、新建会话、继续会话。
- daemon 发起任务的远程审批与停止。
- 图片上传、会话图片查看、围观只读链接、webhook 通知。
- 设备在线或任务运行时防睡眠。

第一版不修改官方 Codex，因此：

- 官方 Codex 桌面 UI 可能不会自动显示远程发送的新消息，需要手动刷新或重新打开会话。
- 官方桌面 UI 自己启动的任务，其审批和停止不保证能被独立 daemon 接管。
- 不做中文化、Browser/Computer Use gate 修改、官方 App 页面按钮注入。

## 常用脚本

| 脚本 | 说明 |
| --- | --- |
| `npm test` | 运行全部测试。 |
| `npm run remote:relay` | 启动本地 Node relay。 |
| `npm run remote:daemon` | 启动开发用 daemon。 |
| `npm run remote:pair` | 用当前 daemon 配置生成配对链接。 |
| `npm run desktop:win:dev` | 编译并启动 Windows 开发托盘。 |
| `npm run build:desktop:win` | 构建 Windows 安装包。 |
| `npm run deploy:worker` | 部署 Cloudflare Worker relay。 |
| `npm run deploy:web` | 部署 Cloudflare Pages 前端。 |
| `npm run deploy` | 依次部署 Worker 与 Pages。 |
| `npm run release` | 递增版本、打 tag、推送并触发 GitHub Release 构建。 |

## 测试

```powershell
npm test
```

排障入口见 [docs/troubleshooting.md](docs/troubleshooting.md)。
