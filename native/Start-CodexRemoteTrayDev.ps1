param(
  [string]$SourceRoot = ""
)

$ErrorActionPreference = "Stop"

if (!$SourceRoot) {
  $SourceRoot = Split-Path -Parent $PSScriptRoot
}
$SourceRoot = [System.IO.Path]::GetFullPath($SourceRoot)

$Node = (Get-Command node -ErrorAction Stop).Source
$Backend = Join-Path $SourceRoot "launcher\win\remote-backend.mjs"
$Exe = Join-Path $SourceRoot "native\CodexRemoteTray.exe"

if (!(Test-Path $Backend)) {
  throw "Windows remote backend not found: $Backend"
}

$Existing = Get-Process CodexRemoteTray -ErrorAction SilentlyContinue | Where-Object {
  try {
    $_.Path -and ([System.IO.Path]::GetFullPath($_.Path) -eq $Exe)
  } catch {
    $false
  }
}
if ($Existing) {
  $Existing | Stop-Process -Force
  Start-Sleep -Milliseconds 300
}

& (Join-Path $SourceRoot "native\Build-CodexRemoteTray.ps1") -SourceRoot $SourceRoot -OutFile $Exe

$Psi = [System.Diagnostics.ProcessStartInfo]::new()
$Psi.FileName = $Exe
$Psi.Arguments = "`"$Node`" `"$Backend`""
$Psi.WorkingDirectory = $SourceRoot
$Psi.UseShellExecute = $false
$Psi.EnvironmentVariables["CODEX_REMOTE_APP_ROOT"] = $SourceRoot
[System.Diagnostics.Process]::Start($Psi) | Out-Null
Write-Host "Codex Remote tray started."
