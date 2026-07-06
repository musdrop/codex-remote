# Windows 桌面端

Windows 桌面端以便携目录形式分发，不提供安装器。它不内置官方 Codex，只负责找到用户已安装的官方 Codex Desktop 引擎，并启动本项目 daemon。

## 构建

构建前先确认 `config/product.json` 已写入正式 relay 与前端地址：

```json
{
  "relayUrl": "wss://relay.example.com",
  "webUrl": "https://remote.example.com/"
}
```

构建命令：

```powershell
npm run build:desktop:win
```

输出目录：

```text
dist/desktop/windows/CodexRemote
```

## 便携目录内容

便携目录包含：

- `CodexRemoteTray.exe`：系统托盘程序。
- `Start-CodexRemote.cmd`：双击启动托盘。
- `node/node.exe`：随包携带的 Node 运行时。
- `config/product.json`：发布者配置。
- `launcher/`、`remote/daemon/src/`、`src/desktop/`：托盘后端、daemon 与必要工具代码。

便携目录不包含：

- `README.md`
- `remote/web`
- `remote/relay-worker`
- `remote/relay-node`

前端和 Worker 分别部署，不随桌面端一起打包。

## 运行

双击：

```text
Start-CodexRemote.cmd
```

启动后会出现系统托盘图标。右键托盘图标可以：

- 查看远程是否启用/运行。
- 设置 Codex Desktop 引擎路径。
- 启动远程。
- 扫码配对手机。
- 查看和撤销已配对设备。
- 配置通知渠道。
- 停用远程。
- 退出并停止远程。

已有手机配对时，只点“启动远程”即可让手机网页重新连上这台电脑。需要新设备配对时，再点“扫码配对手机”。这两个入口都会在必要时启用 daemon。

## Codex Desktop 引擎查找顺序

独立版不会使用内置 Codex，而是按以下顺序查找官方 Codex Desktop 随包的 app-server 引擎：

1. 环境变量 `CODEX_REMOTE_CODEX`。
2. daemon 配置中的 `codexCommand`。
3. `PATH` 中的真实 `codex.exe`。
4. 常见官方 Codex App 路径映射。

Windows 官方桌面 App 的 `app\Codex.exe` 是桌面壳；真正可用于 daemon 的引擎通常在：

```text
app\resources\codex.exe
```

如果自动检测失败，可在托盘“设置”窗口中手动选择 `app\resources\codex.exe`。保存前会探测它是否支持 `app-server --listen`，通过后才写入用户配置。

自动检测不会选择 npm 全局安装生成的 `codex.cmd` / `codex.ps1`，因为这类 shim 不是 Codex Desktop 安装目录里的引擎入口。宁可提示用户手动选择，也不把错误路径写入配置。

## 用户配置

默认位置：

```text
%USERPROFILE%\.codex-remote\remote\daemon.json
```

这里保存：

- daemon 身份与密钥。
- 已配对设备元数据。
- 通知渠道。
- Codex Desktop 引擎路径。
- 防睡眠等运行配置。

`relayUrl` 和 `webUrl` 由 `config/product.json` 管理，用户只能查看，不能在托盘中修改。

## 停止行为

托盘里的“停用远程”和“退出并停止远程”都会：

- 停止 Windows 计划任务。
- 删除 Windows 计划任务。
- 清理旧版遗留任务名。
- 兜底终止当前便携目录/源码目录下残留的 daemon 进程树。

退出托盘不会让远程服务继续在后台运行。

## 开发托盘

源码开发时使用：

```powershell
npm run desktop:win:dev
```

该命令会编译 `native/CodexRemoteTray.cs`，并使用源码目录中的后端脚本启动托盘。再次运行会先结束当前源码目录里的旧托盘实例。
