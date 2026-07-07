using Microsoft.Win32;
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace CodexRemoteUninstall
{
    static class Program
    {
        const string UninstallKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\CodexRemote";

        [STAThread]
        static void Main(string[] args)
        {
            bool silent = Array.Exists(args, a => String.Equals(a, "/silent", StringComparison.OrdinalIgnoreCase));
            string installDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
            if (!silent)
            {
                DialogResult answer = MessageBox.Show(
                    "确定要卸载 Codex Remote 吗？远程服务会被停用。",
                    "卸载 Codex Remote",
                    MessageBoxButtons.OKCancel,
                    MessageBoxIcon.Question
                );
                if (answer != DialogResult.OK) return;
            }

            StopRemote(installDir);
            DeleteShortcut(DesktopShortcutPath());
            DeleteShortcut(StartMenuShortcutPath());
            try { Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false); } catch { }
            ScheduleInstallDirRemoval(installDir);

            if (!silent)
            {
                MessageBox.Show("Codex Remote 已卸载。", "卸载完成", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
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

        static string DesktopShortcutPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                "Codex Remote.lnk"
            );
        }

        static string StartMenuShortcutPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                "Codex Remote.lnk"
            );
        }

        static void DeleteShortcut(string shortcutPath)
        {
            try
            {
                if (File.Exists(shortcutPath)) File.Delete(shortcutPath);
            }
            catch
            {
            }
        }

        static void ScheduleInstallDirRemoval(string installDir)
        {
            string args = "/C ping 127.0.0.1 -n 2 > nul & rmdir /S /Q " + Quote(installDir);
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            Process.Start(psi);
        }

        static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }
    }
}
