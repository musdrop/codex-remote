using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace CodexRemoteSetup
{
    static class Program
    {
        const string AppName = "Codex Remote";
        const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\CodexRemote";

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }

        public static string DefaultInstallDir()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                "Codex Remote"
            );
        }

        public static string DesktopShortcutPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                "Codex Remote.lnk"
            );
        }

        public static string StartMenuShortcutPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                "Codex Remote.lnk"
            );
        }

        public static void InstallTo(string installDir)
        {
            Directory.CreateDirectory(installDir);
            StopRemote(installDir);
            ExtractPayload(installDir);

            string tray = Path.Combine(installDir, "CodexRemoteTray.exe");
            CreateShortcut(DesktopShortcutPath(), tray, installDir);
            CreateShortcut(StartMenuShortcutPath(), tray, installDir);
            WriteUninstallMetadata(installDir);
        }

        static void StopRemote(string installDir)
        {
            string node = Path.Combine(installDir, "node", "node.exe");
            string backend = Path.Combine(installDir, "launcher", "win", "remote-backend.mjs");
            if (!File.Exists(node) || !File.Exists(backend)) return;
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = node,
                    Arguments = Quote(backend) + " disable",
                    WorkingDirectory = installDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                using (var p = Process.Start(psi))
                {
                    p.WaitForExit(15000);
                }
            }
            catch
            {
            }
        }

        static void ExtractPayload(string installDir)
        {
            string root = Path.GetFullPath(installDir);
            if (!root.EndsWith(Path.DirectorySeparatorChar.ToString())) root += Path.DirectorySeparatorChar;

            using (Stream payload = OpenPayload())
            using (var zip = new ZipArchive(payload, ZipArchiveMode.Read))
            {
                foreach (var entry in zip.Entries)
                {
                    string relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    string target = Path.GetFullPath(Path.Combine(root, relative));
                    if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("安装包内容包含非法路径: " + entry.FullName);
                    }

                    if (String.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(target);
                        continue;
                    }

                    Directory.CreateDirectory(Path.GetDirectoryName(target));
                    using (Stream input = entry.Open())
                    using (var output = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        input.CopyTo(output);
                    }
                }
            }
        }

        static Stream OpenPayload()
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            foreach (string name in asm.GetManifestResourceNames())
            {
                if (name.EndsWith("CodexRemotePayload.zip", StringComparison.OrdinalIgnoreCase))
                {
                    return asm.GetManifestResourceStream(name);
                }
            }
            throw new InvalidOperationException("安装器缺少内嵌 payload。");
        }

        static void CreateShortcut(string shortcutPath, string targetPath, string workingDir)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(shortcutPath));
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember(
                "CreateShortcut",
                BindingFlags.InvokeMethod,
                null,
                shell,
                new object[] { shortcutPath }
            );
            Type shortcutType = shortcut.GetType();
            shortcutType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
            shortcutType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { workingDir });
            shortcutType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { targetPath });
            shortcutType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        }

        static void WriteUninstallMetadata(string installDir)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(UninstallKey))
            {
                key.SetValue("DisplayName", AppName);
                key.SetValue("DisplayVersion", BuildInfo.Version);
                key.SetValue("Publisher", "Codex Remote");
                key.SetValue("InstallLocation", installDir);
                key.SetValue("DisplayIcon", Path.Combine(installDir, "CodexRemoteTray.exe"));
                key.SetValue("UninstallString", Quote(Path.Combine(installDir, "CodexRemoteUninstall.exe")));
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }

        static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }
    }

    sealed class SetupForm : Form
    {
        readonly TextBox installDir;
        readonly Button installButton;
        readonly CheckBox launchAfterInstall;

        public SetupForm()
        {
            Text = "安装 Codex Remote";
            Width = 560;
            Height = 250;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            Font = new Font("Microsoft YaHei UI", 9f);

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 5,
                Padding = new Padding(18),
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92f));
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92f));
            for (int i = 0; i < 5; i++) root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            Controls.Add(root);

            var title = new Label
            {
                Text = "安装 Codex Remote",
                Font = new Font("Microsoft YaHei UI", 14f, FontStyle.Bold),
                AutoSize = true,
                Margin = new Padding(0, 0, 0, 12),
            };
            root.Controls.Add(title, 0, 0);
            root.SetColumnSpan(title, 3);

            var hint = new Label
            {
                Text = "请选择安装位置。安装后会创建桌面和开始菜单快捷方式。",
                AutoSize = true,
                ForeColor = Color.DimGray,
                Margin = new Padding(0, 0, 0, 8),
            };
            root.Controls.Add(hint, 0, 1);
            root.SetColumnSpan(hint, 3);

            installDir = new TextBox { Text = Program.DefaultInstallDir(), Dock = DockStyle.Fill };
            root.Controls.Add(installDir, 0, 2);

            var browse = new Button { Text = "浏览", Dock = DockStyle.Fill };
            browse.Click += (s, e) => BrowseInstallDir();
            root.Controls.Add(browse, 1, 2);

            installButton = new Button { Text = "安装", Dock = DockStyle.Fill };
            installButton.Click += (s, e) => DoInstall();
            root.Controls.Add(installButton, 2, 2);

            launchAfterInstall = new CheckBox
            {
                Text = "安装完成后启动 Codex Remote",
                Checked = true,
                AutoSize = true,
                Margin = new Padding(0, 18, 0, 0),
            };
            root.Controls.Add(launchAfterInstall, 0, 3);
            root.SetColumnSpan(launchAfterInstall, 3);
        }

        void BrowseInstallDir()
        {
            using (var dlg = new FolderBrowserDialog())
            {
                dlg.Description = "选择 Codex Remote 安装目录";
                dlg.SelectedPath = installDir.Text;
                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    installDir.Text = dlg.SelectedPath;
                }
            }
        }

        void DoInstall()
        {
            installButton.Enabled = false;
            try
            {
                Program.InstallTo(installDir.Text.Trim());
                if (launchAfterInstall.Checked)
                {
                    Process.Start(Path.Combine(installDir.Text.Trim(), "CodexRemoteTray.exe"));
                }
                MessageBox.Show(this, "Codex Remote 已安装完成。", "安装完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
                Close();
            }
            catch (Exception ex)
            {
                installButton.Enabled = true;
                MessageBox.Show(this, ex.Message, "安装失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
