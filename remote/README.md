# Codex Remote 子系统

本目录是 Codex Remote 的远程协作核心。当前项目将它作为独立能力使用：不随官方 Codex 打包，不修改官方 Codex 安装目录，只通过官方 `codex app-server` 与 Codex 会话交互。

协议细节见 [PROTOCOL.md](PROTOCOL.md)。

## 组成

| 目录 | 说明 |
| --- | --- |
| `daemon/` | 电脑端守护进程：启动 `codex app-server`、连接 relay、端到端加密、配对与设备管理、rollout 实时推送。 |
| `web/` | 浏览器/PWA 前端：会话看板、聊天流、审批卡、图片、模型/权限选择、围观链接等。 |
| `relay-worker/` | Cloudflare Worker + Durable Objects relay，适合公网部署。 |
| `relay-node/` | 零依赖 Node relay，适合本地开发或自托管。 |
| `scripts/smoke.mjs` | relay + daemon + 模拟客户端的端到端冒烟。 |
| `scripts/web-e2e-backend.mjs` | 浏览器 e2e 辅助后端，原型项目遗留，后续会按独立项目重新整理。 |

## 三端职责

### 桌面端 daemon

daemon 运行在用户电脑上。它会启动官方 Codex CLI：

```text
codex app-server --listen ws://127.0.0.1:<port>
```

然后通过 JSON-RPC 调用 app-server，例如：

- `thread/list`
- `thread/resume`
- `thread/start`
- `turn/start`
- `turn/interrupt`
- `model/list`
- `thread/goal/set|get|clear`

daemon 同时会监听会话 rollout 文件，让前端能看到官方 Codex 桌面端正在写入的会话内容。

### Relay 中转端

relay 只做 WebSocket 撮合与转发：

- daemon 连接 `/v1/daemon/<daemonId>`
- 前端连接 `/v1/client/<daemonId>`

relay 不解密消息，不保存设备令牌，不理解业务协议。它只看到 `daemonId`、连接状态和密文帧。

### 浏览器前端

`web/` 是静态前端。它通过配对链接里的 hash 获得：

- relay 地址
- daemonId
- daemon 公钥
- 电脑名
- 一次性配对令牌或长期设备令牌

前端不需要构建，也不需要提前写死 relay 地址。正式使用时只需要部署到 HTTPS 静态站。

## 本地启动

建议优先使用根目录脚本，见 [../README.md](../README.md)。

等价的底层命令如下：

```powershell
# 1. relay
node remote/relay-node/server.mjs --port 8787

# 2. daemon
node remote/daemon/src/main.mjs start --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/ --codex "C:\Path\To\codex.exe"

# 3. 配对链接
node remote/daemon/src/main.mjs pair

# 4. 前端
python -m http.server 4173 -d remote/web
```

真实手机使用时，`--relay` 必须指向手机能访问的 `wss://` 公网地址，`--web` 必须指向手机能访问的 HTTPS 前端地址。

## 持久化配置

daemon 默认配置文件：

```text
~/.codex-remote/remote/daemon.json
```

里面保存：

- daemonId 和 X25519 长期密钥。
- `relayUrl`。
- `webUrl`。
- `codexCommand`。
- 设备令牌哈希。
- 围观链接信息。
- 通知渠道。

`--relay`、`--web`、`--codex` 会写入该配置；下一次启动可复用。

## 已实现能力

- E2E 加密：X25519 + HKDF + AES-256-GCM。
- 扫码/链接配对与设备令牌。
- Cloudflare Worker relay 和 Node relay 两种形态。
- 会话列表、历史查看、实时 rollout tail。
- 远程发消息、新建会话、继续会话、停止 daemon 驱动的 turn。
- daemon 驱动任务的远程审批。
- 模型列表、按轮模型/权限选择、计划模式、目标设置。
- 图片上传和会话内图片分块获取。
- 单会话只读围观链接、喝彩、观众数和战报。
- webhook 通知。
- 设备在线或任务运行时阻止系统睡眠。
- 分层连接诊断与心跳。

## 独立版边界

当前独立版不修改官方 Codex，因此这些能力不作为第一版承诺：

- 官方 Codex 桌面 UI 自动刷新远程发送的新消息。
- 稳定接管官方桌面 UI 自己发起的审批。
- 稳定停止官方桌面 UI 自己启动的任务。
- 官方 App 中文化、功能 gate 修改、页面按钮注入。
