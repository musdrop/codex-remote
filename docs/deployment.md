# 部署指南

正式部署通常包含三部分：公网 relay、HTTPS 前端、Windows 桌面安装包。

## 部署顺序

1. 部署 relay，得到 `wss://...` 地址。
2. 部署前端，得到 `https://...` 地址。
3. 写入 `config/product.json`。
4. 构建 Windows 安装包并分发给用户。

## 部署 relay

推荐使用 Cloudflare Worker：

```powershell
cd remote/relay-worker
npx wrangler login
npx wrangler deploy
```

也可以在项目根目录执行：

```powershell
npm run deploy:worker
```

`remote/relay-worker/wrangler.toml` 默认不绑定生产域名。若要使用自定义域名，可以在 Cloudflare 控制台绑定，也可以配置路由：

```toml
routes = [{ pattern = "relay.example.com/*", zone_name = "example.com" }]
```

部署完成后，daemon 使用的 relay 地址形如：

```text
wss://relay.example.com
```

## 部署前端

`remote/web` 是纯静态前端，可以部署到任意 HTTPS 静态站：

- Cloudflare Pages
- GitHub Pages
- Nginx 静态目录
- 对象存储静态站点

部署到 Cloudflare Pages：

```powershell
npm run deploy:web -- --project-name codex-remote-web
```

也可以使用环境变量：

```powershell
$env:CODEX_REMOTE_PAGES_PROJECT="codex-remote-web"
npm run deploy:web
```

Worker 与 Pages 一起部署：

```powershell
npm run deploy -- --project-name codex-remote-web
```

这些命令不构建 web 或 worker，只是调用 Wrangler 部署现有目录。

## 写入发布者配置

编辑：

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

这两个地址属于发布者配置。构建桌面安装包时会被复制进去，用户在托盘设置里只能查看。

## 构建 Windows 安装包

构建 Windows 安装包不依赖 Inno Setup、WiX 或 NSIS，只需要 Windows 环境中的 C# 编译器。GitHub Actions `windows-latest` 可直接构建。

```powershell
npm run build:desktop:win
```

输出安装包：

```text
dist/desktop/windows/installer/CodexRemote-Setup-<version>.exe
```

安装向导允许用户选择安装目录，并会创建桌面与开始菜单快捷方式。

桌面端的详细说明见 [desktop-windows.md](desktop-windows.md)。

## 自托管 Node relay

本地或自托管也可以使用 Node relay：

```powershell
node remote/relay-node/server.mjs --host 0.0.0.0 --port 8787
```

生产环境需要在前面放 TLS 反向代理，并让 daemon 使用 `wss://你的域名`。

## 配置如何关联三端

配对链接建立三端关系：

- `webUrl` 决定链接打开哪个前端页面。
- `relayUrl` 被写进 URL hash，前端据此连接 relay。
- `daemonId` 被写进 URL hash，relay 据此把前端连接转给对应电脑。
- daemon 公钥被写进 URL hash，前端据此建立端到端加密会话。
- 配对令牌只用于首次换取长期设备令牌。

因此，前端部署后不需要单独配置 relay；真正的连接信息都由 daemon 生成的配对链接携带。
