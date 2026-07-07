# 开发指南

本文记录本地开发和调试常用流程。正式部署请看 [deployment.md](deployment.md)，Windows 桌面端请看 [desktop-windows.md](desktop-windows.md)。

## 本地三端开发

本地开发适合在同一台电脑的浏览器里验证链路。若要用真实手机扫码，请使用公网 `wss://` relay 和 HTTPS 前端，因为手机无法访问电脑上的 `127.0.0.1`。

### 1. 启动本地 relay

```powershell
npm run remote:relay
```

默认地址：

```text
ws://127.0.0.1:8787
```

### 2. 启动前端静态服务

可以使用任意静态服务器，例如：

```powershell
python -m http.server 4173 -d remote/web
```

本地前端地址：

```text
http://127.0.0.1:4173/
```

### 3. 启动开发 daemon

如果本机能自动检测到官方 Codex Desktop 内置 Codex CLI：

```powershell
npm run remote:daemon -- --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
```

如果需要指定官方 Codex Desktop 内置 Codex CLI：

```powershell
npm run remote:daemon -- --codex "C:\Path\To\Codex\app\resources\codex.exe" --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
```

npm 11 在部分环境里会把 `--codex`、`--relay`、`--web` 当作 npm 自己的配置项处理。本项目也兼容位置参数：

```powershell
npm run remote:daemon -- "C:\Path\To\Codex\app\resources\codex.exe" ws://127.0.0.1:8787 http://127.0.0.1:4173/
```

也可以绕过 npm：

```powershell
node scripts/start-daemon.mjs --codex "C:\Path\To\Codex\app\resources\codex.exe" --relay ws://127.0.0.1:8787 --web http://127.0.0.1:4173/
```

### 4. 生成配对链接

```powershell
npm run remote:pair
```

在浏览器打开输出的链接。配对成功后，前端会保存设备令牌，后续可直接重连。

## Windows 托盘开发

启动开发托盘：

```powershell
npm run desktop:win:dev
```

这个命令会：

- 编译 `native/CodexRemoteTray.cs`。
- 使用当前源码目录里的 `launcher/win/remote-backend.mjs`。
- 设置 `CODEX_REMOTE_APP_ROOT` 指向源码根目录。
- 结束当前源码目录里的旧托盘实例，避免误用旧进程。

开发托盘和安装版共用用户配置：

```text
%USERPROFILE%\.codex-remote\remote\daemon.json
```

该命令构建托盘程序也会加载发布者配置

```text
config/product.json
```

## 常用调试命令

查看 Windows 后端状态：

```powershell
node launcher\win\remote-backend.mjs status
```

生成托盘同款配对链接：

```powershell
node launcher\win\remote-backend.mjs pair
```

停用远程并清理残留 daemon：

```powershell
node launcher\win\remote-backend.mjs disable
```

运行 smoke 测试脚本：

```powershell
npm run remote:smoke
```

## 开发注意事项

- `remote:*` 命令是开发调试入口，不是最终用户的桌面启动界面。
- 前端和 Worker 不需要构建，直接部署源目录。
- Windows 安装包只打包运行 daemon 所需的文件，不包含 `remote/web`、`remote/relay-worker`、`remote/relay-node`。
- 若本地已有一个 daemon 占用 `19271`，daemon 会自动尝试下一个可用端口。
- Windows 自动检测只接受真实 `codex.exe`，不会把 npm 全局安装的 `codex.cmd` 当作 Codex Desktop 内置 Codex CLI。
