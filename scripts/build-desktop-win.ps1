param(
  [string]$SourceRoot = "",
  [string]$AppStageRoot = "",
  [string]$InstallerOutputRoot = ""
)

$ErrorActionPreference = "Stop"

if (!$SourceRoot) {
  $SourceRoot = Split-Path -Parent $PSScriptRoot
}
$SourceRoot = [System.IO.Path]::GetFullPath($SourceRoot)

if (!$AppStageRoot) {
  $AppStageRoot = Join-Path $SourceRoot "dist\desktop\windows\app"
}
$AppStageRoot = [System.IO.Path]::GetFullPath($AppStageRoot)

if (!$InstallerOutputRoot) {
  $InstallerOutputRoot = Join-Path $SourceRoot "dist\desktop\windows\installer"
}
$InstallerOutputRoot = [System.IO.Path]::GetFullPath($InstallerOutputRoot)

$expectedDistRoot = [System.IO.Path]::GetFullPath((Join-Path $SourceRoot "dist"))
foreach ($target in @($AppStageRoot, $InstallerOutputRoot)) {
  if (!$target.StartsWith($expectedDistRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Build output must be inside $expectedDistRoot"
  }
}

$Node = (Get-Command node -ErrorAction Stop).Source
$Package = Get-Content -Raw (Join-Path $SourceRoot "package.json") | ConvertFrom-Json
$Version = $Package.version

function Assert-NodeRuntime([string]$NodePath) {
  $versionText = (& $NodePath --version).Trim()
  if ($versionText -notmatch '^v(\d+)\.') {
    throw "Unable to determine Node.js version from: $versionText"
  }
  $major = [int]$Matches[1]
  if ($major -lt 24) {
    throw "Node.js 24 or newer is required for the bundled daemon runtime. Current node is $versionText at $NodePath."
  }
  $webSocketCheck = & $NodePath -e "process.exit(typeof WebSocket === 'function' ? 0 : 1)"
  if ($LASTEXITCODE -ne 0) {
    throw "Node.js runtime must provide global WebSocket for codex app-server. Current node is $versionText at $NodePath."
  }
}

function Resolve-CSharpCompiler {
  $candidates = @(
    (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
    (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }

  $command = Get-Command csc.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw "csc.exe not found. Install .NET Framework developer tools or .NET SDK."
}

function Invoke-CSharpCompile([string]$OutFile, [string[]]$Sources, [string[]]$References, [string[]]$ExtraArgs = @()) {
  $args = @(
    "/nologo",
    "/target:winexe",
    "/platform:x64",
    "/optimize+",
    "/out:$OutFile"
  )
  foreach ($ref in $References) {
    $args += "/reference:$ref"
  }
  $args += $ExtraArgs
  $args += $Sources

  & $Csc @args
  if ($LASTEXITCODE -ne 0) {
    throw "C# compile failed for $OutFile with exit code $LASTEXITCODE."
  }
  if (!(Test-Path $OutFile)) {
    throw "C# compiler did not create $OutFile"
  }
}

function Stop-StagedRuntime([string]$Root) {
  if (!(Test-Path $Root)) { return }
  $needle = $Root.Replace("/", "\").ToLowerInvariant()
  $processes = Get-CimInstance Win32_Process | Where-Object {
    $cmd = [string]($_.CommandLine)
    $exe = [string]($_.ExecutablePath)
    $cmd.Replace("/", "\").ToLowerInvariant().Contains($needle) -or
      $exe.Replace("/", "\").ToLowerInvariant().Contains($needle)
  }
  foreach ($proc in $processes) {
    if ($proc.ProcessId -eq $PID) { continue }
    & taskkill.exe /PID $proc.ProcessId /T /F *> $null
  }
  if ($processes) {
    Start-Sleep -Milliseconds 500
  }
}

Assert-NodeRuntime $Node
Stop-StagedRuntime $AppStageRoot

if (Test-Path $AppStageRoot) {
  Remove-Item -LiteralPath $AppStageRoot -Recurse -Force
}
if (Test-Path $InstallerOutputRoot) {
  Remove-Item -LiteralPath $InstallerOutputRoot -Recurse -Force
}
New-Item -ItemType Directory -Force $AppStageRoot | Out-Null
New-Item -ItemType Directory -Force (Join-Path $AppStageRoot "node") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $AppStageRoot "config") | Out-Null
New-Item -ItemType Directory -Force $InstallerOutputRoot | Out-Null

& (Join-Path $SourceRoot "native\Build-CodexRemoteTray.ps1") `
  -SourceRoot $SourceRoot `
  -OutFile (Join-Path $AppStageRoot "CodexRemoteTray.exe")

Copy-Item -LiteralPath $Node -Destination (Join-Path $AppStageRoot "node\node.exe") -Force
Copy-Item -LiteralPath (Join-Path $SourceRoot "config\product.json") -Destination (Join-Path $AppStageRoot "config\product.json") -Force

function Copy-FileRelative([string]$RelativePath) {
  $src = Join-Path $SourceRoot $RelativePath
  $dst = Join-Path $AppStageRoot $RelativePath
  New-Item -ItemType Directory -Force (Split-Path -Parent $dst) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Force
}

function Copy-DirRelative([string]$RelativePath) {
  $src = Join-Path $SourceRoot $RelativePath
  $dst = Join-Path $AppStageRoot $RelativePath
  New-Item -ItemType Directory -Force (Split-Path -Parent $dst) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
}

Copy-DirRelative "remote\daemon\src"
Copy-FileRelative "launcher\remote-backend-core.mjs"
Copy-FileRelative "launcher\win\remote-backend.mjs"
Copy-FileRelative "launcher\win\run-hidden.vbs"
Copy-FileRelative "launcher\win\qr-bmp.mjs"
Copy-DirRelative "launcher\win\vendor"
Copy-FileRelative "scripts\lib\desktop\codex-command.mjs"
Copy-FileRelative "scripts\lib\desktop\product-config.mjs"

$Csc = Resolve-CSharpCompiler
$IconFile = Join-Path $SourceRoot "app\resources\icon.ico"
$IconArgs = @()
if (Test-Path $IconFile) {
  $IconArgs += "/win32icon:$IconFile"
}

Invoke-CSharpCompile `
  -OutFile (Join-Path $AppStageRoot "CodexRemoteUninstall.exe") `
  -Sources @((Join-Path $SourceRoot "native\CodexRemoteUninstall.cs")) `
  -References @("System.dll", "System.Windows.Forms.dll") `
  -ExtraArgs $IconArgs

$PayloadZip = Join-Path $InstallerOutputRoot "CodexRemotePayload.zip"
Compress-Archive -Path (Join-Path $AppStageRoot "*") -DestinationPath $PayloadZip -Force

$GeneratedVersion = Join-Path $InstallerOutputRoot "CodexRemoteSetupVersion.cs"
Set-Content -LiteralPath $GeneratedVersion -Encoding UTF8 -Value @"
namespace CodexRemoteSetup
{
    static class BuildInfo
    {
        public const string Version = "$Version";
    }
}
"@

$SetupOut = Join-Path $InstallerOutputRoot "CodexRemote-Setup-$Version.exe"
Invoke-CSharpCompile `
  -OutFile $SetupOut `
  -Sources @((Join-Path $SourceRoot "native\CodexRemoteSetup.cs"), $GeneratedVersion) `
  -References @("System.dll", "System.Drawing.dll", "System.Windows.Forms.dll", "System.IO.Compression.dll") `
  -ExtraArgs ($IconArgs + @("/resource:$PayloadZip,CodexRemotePayload.zip"))

Remove-Item -LiteralPath $PayloadZip -Force
Remove-Item -LiteralPath $GeneratedVersion -Force

Get-Item $SetupOut | Select-Object FullName,Length,LastWriteTime
