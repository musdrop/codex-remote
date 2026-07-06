param(
  [string]$SourceRoot = "",
  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"

if (!$SourceRoot) {
  $SourceRoot = Split-Path -Parent $PSScriptRoot
}
$SourceRoot = [System.IO.Path]::GetFullPath($SourceRoot)

if (!$OutputRoot) {
  $OutputRoot = Join-Path $SourceRoot "dist\desktop\windows\CodexRemote"
}
$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

$expectedDistRoot = [System.IO.Path]::GetFullPath((Join-Path $SourceRoot "dist"))
if (!$OutputRoot.StartsWith($expectedDistRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputRoot must be inside $expectedDistRoot"
}

$Node = (Get-Command node -ErrorAction Stop).Source

if (Test-Path $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Force $OutputRoot | Out-Null
New-Item -ItemType Directory -Force (Join-Path $OutputRoot "node") | Out-Null

& (Join-Path $SourceRoot "native\Build-CodexRemoteTray.ps1") `
  -SourceRoot $SourceRoot `
  -OutFile (Join-Path $OutputRoot "CodexRemoteTray.exe")

Copy-Item -LiteralPath $Node -Destination (Join-Path $OutputRoot "node\node.exe") -Force

foreach ($dir in @("remote", "launcher", "src")) {
  Copy-Item -LiteralPath (Join-Path $SourceRoot $dir) -Destination (Join-Path $OutputRoot $dir) -Recurse -Force
}

Copy-Item -LiteralPath (Join-Path $SourceRoot "README.md") -Destination (Join-Path $OutputRoot "README.md") -Force

$cmd = @'
@echo off
set "ROOT=%~dp0"
start "" "%ROOT%CodexRemoteTray.exe" "%ROOT%node\node.exe" "%ROOT%launcher\win\remote-backend.mjs"
'@
Set-Content -LiteralPath (Join-Path $OutputRoot "Start-CodexRemote.cmd") -Value $cmd -Encoding ASCII

Get-ChildItem $OutputRoot | Select-Object FullName,Length,LastWriteTime
