[CmdletBinding()]
param(
  [string]$ReleaseTag = "",
  [string]$OutputDirectory = "",
  [string]$NodeVersion = "24.13.0"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $previousErrorAction = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & git -C $WorkingDirectory @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  if ($exitCode -ne 0) {
    throw "git $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
  }
  return ($output -join "`n").Trim()
}

function Assert-OfficialOrigin {
  param([Parameter(Mandatory = $true)][string]$OriginUrl)

  $normalized = $OriginUrl.Trim().TrimEnd("/").ToLowerInvariant()
  $allowed = @(
    "https://github.com/asphyxiachoke/forkline.git",
    "https://github.com/asphyxiachoke/forkline",
    "git@github.com:asphyxiachoke/forkline.git",
    "git@github.com:asphyxiachoke/forkline"
  )
  if ($allowed -notcontains $normalized) {
    throw "Portable builds require the official Forkline origin. Current origin: $OriginUrl"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputDirectory) {
  $OutputDirectory = Join-Path $repoRoot "dist"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)

$status = Invoke-Git -WorkingDirectory $repoRoot -Arguments @("status", "--porcelain", "--untracked-files=normal")
if ($status) {
  throw "Portable builds require a clean working tree. Commit or stash the current changes first."
}

$originUrl = Invoke-Git -WorkingDirectory $repoRoot -Arguments @("remote", "get-url", "origin")
Assert-OfficialOrigin -OriginUrl $originUrl

if (-not $ReleaseTag) {
  $currentPackage = Get-Content -LiteralPath (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
  $ReleaseTag = "v$($currentPackage.version)"
}
if ($ReleaseTag -notmatch "^v\d+\.\d+\.\d+$") {
  throw "Release tag must use the vMAJOR.MINOR.PATCH format. Current value: $ReleaseTag"
}

$tagSha = Invoke-Git -WorkingDirectory $repoRoot -Arguments @("rev-parse", "$ReleaseTag^{commit}")
$packageText = Invoke-Git -WorkingDirectory $repoRoot -Arguments @("show", "${ReleaseTag}:package.json")
$packageJson = $packageText | ConvertFrom-Json
$version = [string]$packageJson.version
if ($ReleaseTag -ne "v$version") {
  throw "Release tag $ReleaseTag does not match package version $version."
}

$packageName = "Forkline-$ReleaseTag-windows-x64"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("forkline-portable-" + [guid]::NewGuid().ToString("N"))
$packageDirectory = Join-Path $tempRoot $packageName
$archiveName = "node-v$NodeVersion-win-x64.zip"
$nodeBaseUrl = "https://nodejs.org/dist/v$NodeVersion"
$nodeArchive = Join-Path $tempRoot $archiveName
$checksumsFile = Join-Path $tempRoot "SHASUMS256.txt"
$nodeExtractRoot = Join-Path $tempRoot "node"
$zipPath = Join-Path $OutputDirectory "$packageName.zip"
$checksumPath = "$zipPath.sha256"

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null

  Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("init", "-b", "main") | Out-Null
  Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("remote", "add", "origin", $originUrl) | Out-Null
  Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("fetch", "--depth", "1", "origin", "refs/tags/${ReleaseTag}:refs/tags/${ReleaseTag}") | Out-Null
  Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("reset", "--hard", $tagSha) | Out-Null

  $packageBranch = Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("branch", "--show-current")
  $packageHead = Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("rev-parse", "HEAD")
  if ($packageBranch -ne "main" -or $packageHead -ne $tagSha) {
    throw "Portable checkout is not on main at $ReleaseTag."
  }

  Write-Host "Downloading Node.js $NodeVersion..."
  Invoke-WebRequest -Uri "$nodeBaseUrl/$archiveName" -OutFile $nodeArchive
  Invoke-WebRequest -Uri "$nodeBaseUrl/SHASUMS256.txt" -OutFile $checksumsFile

  $archivePattern = "^([a-fA-F0-9]{64})\s+$([regex]::Escape($archiveName))$"
  $checksumLine = Get-Content -LiteralPath $checksumsFile | Where-Object { $_ -match $archivePattern } | Select-Object -First 1
  if (-not $checksumLine -or $checksumLine -notmatch $archivePattern) {
    throw "Node.js checksum for $archiveName was not found."
  }
  $expectedHash = $Matches[1].ToLowerInvariant()
  $actualHash = (Get-FileHash -LiteralPath $nodeArchive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) {
    throw "Node.js archive checksum mismatch."
  }

  Expand-Archive -LiteralPath $nodeArchive -DestinationPath $nodeExtractRoot -Force
  $nodeSource = Join-Path $nodeExtractRoot "node-v$NodeVersion-win-x64"
  $runtimeDirectory = Join-Path $packageDirectory "runtime"
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $nodeSource "node.exe") -Destination (Join-Path $runtimeDirectory "node.exe")
  Copy-Item -LiteralPath (Join-Path $nodeSource "LICENSE") -Destination (Join-Path $runtimeDirectory "NODE-LICENSE.txt")

  @(
    "@echo off",
    "setlocal",
    "cd /d `"%~dp0`"",
    "title Forkline",
    "`"%~dp0runtime\node.exe`" server.js",
    "exit /b %errorlevel%"
  ) | Set-Content -LiteralPath (Join-Path $packageDirectory "Forkline.cmd") -Encoding ascii

  @(
    "Forkline portable package",
    "Forkline version: $version",
    "Forkline tag: $ReleaseTag",
    "Forkline commit: $tagSha",
    "Node.js version: v$NodeVersion"
  ) | Set-Content -LiteralPath (Join-Path $packageDirectory "PORTABLE-INFO.txt") -Encoding ascii

  $excludePath = Join-Path $packageDirectory ".git\info\exclude"
  Add-Content -LiteralPath $excludePath -Encoding ascii -Value @(
    "",
    "/runtime/",
    "/Forkline.cmd",
    "/PORTABLE-INFO.txt"
  )

  & (Join-Path $runtimeDirectory "node.exe") --check (Join-Path $packageDirectory "server.js")
  if ($LASTEXITCODE -ne 0) {
    throw "Bundled Node.js could not parse server.js."
  }
  $portableStatus = Invoke-Git -WorkingDirectory $packageDirectory -Arguments @("status", "--porcelain=v1", "--untracked-files=normal")
  if ($portableStatus) {
    throw "Portable checkout is not clean after adding the excluded runtime."
  }

  Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $checksumPath -Force -ErrorAction SilentlyContinue
  & tar.exe -a -c -f $zipPath -C $tempRoot $packageName
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create the portable ZIP archive."
  }

  $archiveEntries = @(& tar.exe -t -f $zipPath) | ForEach-Object { $_.Replace("\", "/") }
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to inspect the portable ZIP archive."
  }
  $requiredEntries = @(
    "$packageName/.git/HEAD",
    "$packageName/runtime/node.exe",
    "$packageName/Forkline.cmd",
    "$packageName/server.js"
  )
  foreach ($entry in $requiredEntries) {
    if ($archiveEntries -notcontains $entry) {
      throw "Portable ZIP is missing $entry"
    }
  }

  $zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  "$zipHash  $([IO.Path]::GetFileName($zipPath))" | Set-Content -LiteralPath $checksumPath -Encoding ascii
  Write-Host "Portable ZIP: $zipPath"
  Write-Host "SHA256: $zipHash"
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
