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

& (Join-Path $SourceRoot "native\Build-CodexRemoteTray.ps1") -SourceRoot $SourceRoot -OutFile $Exe

Start-Process -FilePath $Exe -ArgumentList @("`"$Node`"", "`"$Backend`"") | Out-Null
Write-Host "Codex Remote tray started."
