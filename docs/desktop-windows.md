# Windows 桌面端

Windows 桌面端以安装包形式分发。它不内置官方 Codex，只负责找到用户已安装的官方 Codex Desktop 内置 Codex CLI，并启动本项目 daemon。

## 构建

构建 Windows 安装包不依赖 Inno Setup、WiX 或 NSIS，只需要 Windows 环境中的 C# 编译器。GitHub Actions `windows-latest` 可直接构建。

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

最终安装包输出到：

```text
dist/desktop/windows/installer/CodexRemote-Setup-<version>.exe
```

构建过程中会生成内部 staging 目录：

```text
dist/desktop/windows/app
```

这个目录只服务于安装器打包，不作为用户交付物分发。

## 图标预留

如果需要给安装器、托盘程序、卸载程序和快捷方式使用自定义图标，把 `.ico` 文件放到：

```text
app/resources/icon.ico
```

下次执行 `npm run build:desktop:win` 时，构建脚本会自动：

- 用该图标编译 `CodexRemoteTray.exe`、`CodexRemoteUninstall.exe` 和安装器。
- 把该图标复制到安装目录的 `app/resources/icon.ico`。
- 让桌面/开始菜单快捷方式优先使用这个图标。

如果该文件不存在，构建会继续使用 Windows 默认程序图标。

## 安装与运行

用户运行安装包后，可以在安装向导中选择安装位置。安装完成后会创建：

- 桌面快捷方式：`Codex Remote`
- 开始菜单快捷方式：`Codex Remote`

快捷方式直接启动：

```text
CodexRemoteTray.exe
```

发布态的 `CodexRemoteTray.exe` 无需脚本或启动参数，会从自身安装目录自动找到：

- `node/node.exe`
- `launcher/win/remote-backend.mjs`

启动后会出现系统托盘图标。右键托盘图标可以：

- 查看远程是否启用/运行。
- 设置 Codex Desktop 内置 Codex CLI 路径。
- 启动远程。
- 扫码配对手机。
- 查看和撤销已配对设备。
- 配置通知渠道。
- 停用远程。
- 退出并停止远程。

已有手机配对时，只点“启动远程”即可让手机网页重新连上这台电脑。需要新设备配对时，再点“扫码配对手机”。这两个入口都会在必要时启用 daemon。

## 安装包内容

安装包包含：

- `CodexRemoteTray.exe`：系统托盘程序。
- `node/node.exe`：随包携带的 Node 运行时。
- `config/product.json`：发布者配置。
- `launcher/`、`remote/daemon/src/`、`scripts/lib/desktop/`：托盘后端、daemon 与必要工具代码。

安装包不包含：

- `README.md`
- `remote/web`
- `remote/relay-worker`
- `remote/relay-node`

前端和 Worker 分别部署，不随桌面端一起打包。

## Codex Desktop 内置 Codex CLI 查找顺序

独立版不会内置官方 Codex，而是按以下顺序查找官方 Codex Desktop 内置的 Codex CLI：

1. 环境变量 `CODEX_REMOTE_CODEX`。
2. daemon 配置中的 `codexCommand`。
3. `PATH` 中的真实 `codex.exe`。
4. 常见官方 Codex App 路径映射。

Windows 官方桌面 App 的 `app\Codex.exe` 是桌面壳；真正可用于 daemon 的 Codex CLI 通常在：

```text
app\resources\codex.exe
```

如果自动检测失败，可在托盘“设置”窗口中手动选择 `app\resources\codex.exe`。保存前会探测它是否支持 `app-server --listen`，通过后才写入用户配置。

自动检测不会选择 npm 全局安装生成的 `codex.cmd` / `codex.ps1`，因为这类 shim 不是 Codex Desktop 安装目录里的内置 CLI 入口。宁可提示用户手动选择，也不把错误路径写入配置。

## 用户配置

默认位置：

```text
%USERPROFILE%\.codex-remote\remote\daemon.json
```

这里保存：

- daemon 身份与密钥。
- 已配对设备元数据。
- 通知渠道。
- Codex Desktop 内置 Codex CLI 路径。
- 防睡眠等运行配置。

`relayUrl` 和 `webUrl` 由 `config/product.json` 管理，用户只能查看，不能在托盘中修改。

## 停止与卸载

托盘里的“停用远程”和“退出并停止远程”都会：

- 停止 Windows 计划任务。
- 删除 Windows 计划任务。
- 清理旧版遗留任务名。
- 兜底终止当前安装目录/源码目录下残留的 daemon 进程树。

退出托盘不会让远程服务继续在后台运行。卸载时，安装器也会先调用后端 `disable`，尽量停用计划任务和后台 daemon。

## 开发托盘

源码开发时使用：

```powershell
npm run desktop:win:dev
```

该命令会编译 `native/CodexRemoteTray.cs`，并使用源码目录中的后端脚本启动托盘。再次运行会先结束当前源码目录里的旧托盘实例。
