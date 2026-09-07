[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$PlanPath,
  [Parameter(Mandatory = $true)][ValidateSet('Prepare', 'Apply')][string]$Mode
)

$ErrorActionPreference = 'Stop'
$plan = Get-Content -Raw -Encoding UTF8 -LiteralPath $PlanPath | ConvertFrom-Json
$transaction = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($PlanPath))
$install = [IO.Path]::GetFullPath($plan.installDirectory).TrimEnd('\')
$payload = Join-Path $transaction 'payload'
$backup = Join-Path $transaction 'backup'
$archive = Join-Path $transaction 'update.zip'
$markerPath = 'resources/forkline-portable.json'

function Package-Path([string]$Directory, [string]$Relative) {
  $parts = $Relative.Replace('\', '/').Split('/')
  if (-not $Relative -or [IO.Path]::IsPathRooted($Relative) -or $Relative -match '[<>:"|?*\x00-\x1f]' -or
      @($parts | Where-Object { -not $_ -or $_ -in @('.', '..') -or $_ -match '[. ]$' }).Count -or
      $parts[0] -in @('data', '.git', '.github')) { throw "Unsafe package path: $Relative" }
  $base = [IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\'
  $target = [IO.Path]::GetFullPath((Join-Path $Directory $Relative))
  if (-not $target.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) { throw "Path escaped package: $Relative" }
  $cursor = $target
  while ($cursor -and $cursor.Length -ge $base.Length - 1) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -Force -LiteralPath $cursor
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Package path contains a link: $Relative" }
    }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  return $target
}

function Read-Manifest([string]$Directory) {
  $value = Get-Content -Raw -Encoding UTF8 -LiteralPath (Package-Path $Directory $markerPath) | ConvertFrom-Json
  if ($value.kind -ne 'electron-portable' -or $value.version -notmatch '^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$' -or -not $value.files) { throw 'Invalid Electron portable manifest.' }
  $seen = @{}
  foreach ($file in $value.files) {
    if ($file -isnot [string] -or $file.Contains('\')) { throw 'Manifest paths must use forward slashes.' }
    [void](Package-Path $Directory $file)
    if ($seen.ContainsKey($file)) { throw "Duplicate package file: $file" }
    $seen[$file] = $true
  }
  foreach ($required in @('Forkline.exe', 'resources/app.asar', $markerPath)) {
    if (-not $seen.ContainsKey($required)) { throw "Missing required portable file: $required" }
  }
  return $value
}

$old = Read-Manifest $install
if ($Mode -eq 'Prepare') {
  $hash = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($archive)
  try { $archiveHash = [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $hash.Dispose() }
  if ($archiveHash -ne $plan.sha256) { throw 'ZIP checksum mismatch.' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($archive)
  try {
    foreach ($entry in $zip.Entries) {
      $relative = $entry.FullName.TrimEnd('/')
      if ($relative) { [void](Package-Path $payload $relative) }
      if (($entry.ExternalAttributes -shr 16 -band 0xF000) -eq 0xA000) { throw 'ZIP symbolic links are not allowed.' }
    }
  } finally { $zip.Dispose() }
  [IO.Compression.ZipFile]::ExtractToDirectory($archive, $payload)
  $next = Read-Manifest $payload
  if ($next.version -ne $plan.version) { throw 'ZIP version differs from the selected release.' }
  $actual = @(Get-ChildItem -LiteralPath $payload -File -Recurse -Force | ForEach-Object { $_.FullName.Substring($payload.Length + 1).Replace('\', '/') })
  if (Compare-Object @($next.files | Sort-Object) @($actual | Sort-Object)) { throw 'ZIP files differ from its portable manifest.' }
  foreach ($file in $next.files) {
    $target = Package-Path $install $file
    if ((Test-Path -LiteralPath $target) -and $old.files -notcontains $file) { throw "Update would overwrite an unrelated file: $file" }
  }
  exit 0
}

$next = Read-Manifest $payload
if ($next.version -ne $plan.version) { throw 'Prepared portable version changed.' }
[IO.File]::WriteAllText((Join-Path $transaction 'helper-ready'), 'ready')
$deadline = [DateTime]::UtcNow.AddMinutes(2)
while (-not (Test-Path -LiteralPath (Join-Path $transaction 'apply'))) {
  if ((Test-Path -LiteralPath (Join-Path $transaction 'cancel')) -or [DateTime]::UtcNow -gt $deadline) { exit 1 }
  Start-Sleep -Milliseconds 100
}
$oldProcess = Get-Process -Id $plan.parentPid -ErrorAction SilentlyContinue
if ($oldProcess -and -not $oldProcess.WaitForExit(30000)) { throw 'Previous Forkline process did not stop; no files were replaced.' }

$saved = [Collections.Generic.List[string]]::new()
$written = [Collections.Generic.List[string]]::new()
$newProcess = $null
$resultFile = Join-Path $install 'data/portable-update-result.json'
function Write-Result($value) {
  [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($resultFile))
  [IO.File]::WriteAllText($resultFile, ($value | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
}
try {
  foreach ($file in @(@($old.files) + @($next.files) | Select-Object -Unique)) {
    $source = Package-Path $install $file
    if (-not (Test-Path -LiteralPath $source)) { continue }
    if ($old.files -notcontains $file) { throw "Unrelated file appeared during update: $file" }
    $destination = Package-Path $backup $file
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
    Copy-Item -LiteralPath $source -Destination $destination
    $saved.Add($file)
  }
  foreach ($file in $old.files) {
    if ($next.files -contains $file) { continue }
    $source = Package-Path $install $file
    if (Test-Path -LiteralPath $source) {
      $written.Add($file)
      Remove-Item -LiteralPath $source -Force
    }
  }
  foreach ($file in $next.files) {
    $destination = Package-Path $install $file
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))
    $written.Add($file)
    Copy-Item -LiteralPath (Package-Path $payload $file) -Destination $destination
  }
  $env:FORKLINE_ELECTRON_UPDATE_HEALTH_FILE = $plan.healthFile
  $env:FORKLINE_ELECTRON_UPDATE_TARGET_VERSION = $plan.version
  $newProcess = Start-Process -FilePath (Join-Path $install 'Forkline.exe') -WorkingDirectory $install -WindowStyle Hidden -PassThru
  Remove-Item Env:FORKLINE_ELECTRON_UPDATE_HEALTH_FILE, Env:FORKLINE_ELECTRON_UPDATE_TARGET_VERSION
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  $healthy = $false
  while ([DateTime]::UtcNow -lt $deadline -and -not $newProcess.HasExited) {
    if (Test-Path -LiteralPath $plan.healthFile) {
      try {
        $health = Get-Content -Raw -Encoding UTF8 -LiteralPath $plan.healthFile | ConvertFrom-Json
        $healthy = $health.ready -and $health.pid -eq $newProcess.Id -and $health.actualVersion -eq $plan.version
      } catch {}
      if ($healthy) { break }
    }
    Start-Sleep -Milliseconds 200
  }
  if (-not $healthy) { throw 'Updated Forkline did not report successful startup.' }
  Write-Result @{ state = 'completed'; targetVersion = $plan.version; backupDirectory = $backup }
} catch {
  $failure = $_.Exception.Message
  if ($newProcess -and -not $newProcess.HasExited) {
    & taskkill.exe /PID $newProcess.Id /T /F | Out-Null
    if (-not $newProcess.WaitForExit(15000)) { throw "Cannot roll back while the new process is running. Backup: $backup" }
  }
  try {
    foreach ($file in $written) {
      $target = Package-Path $install $file
      if ($saved.Contains($file)) {
        Copy-Item -LiteralPath (Package-Path $backup $file) -Destination $target -Force
      } elseif (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Force
      }
    }
    Remove-Item Env:FORKLINE_ELECTRON_UPDATE_HEALTH_FILE, Env:FORKLINE_ELECTRON_UPDATE_TARGET_VERSION -ErrorAction SilentlyContinue
    Start-Process -FilePath (Join-Path $install 'Forkline.exe') -WorkingDirectory $install -WindowStyle Hidden
    Write-Result @{ state = 'error'; phase = 'failed'; rollbackState = 'complete'; serviceState = 'restart-requested'; targetVersion = $plan.version; error = $failure; backupDirectory = $backup }
  } catch {
    Write-Result @{ state = 'error'; phase = 'failed'; rollbackState = 'failed'; serviceState = 'unknown'; targetVersion = $plan.version; error = "$failure Rollback: $($_.Exception.Message)"; backupDirectory = $backup }
    throw
  }
  exit 1
}
