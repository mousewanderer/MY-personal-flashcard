# Opens Flashcards as a desktop window. Serves the production build on http://localhost:5173,
# the same origin as `npm run dev`, so both share the same IndexedDB data in Edge.
# The desktop shortcut runs this. It rebuilds first when the source has changed since the last build.
#   launch.ps1           open the app
#   launch.ps1 -Stop     stop the background server (frees port 5173 for `npm run dev`)
#   launch.ps1 -Install  (re)create the desktop shortcut
param([switch]$Stop, [switch]$Install)

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$url = 'http://localhost:5173/'
Set-Location $root

function Get-Server {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*vite.js preview*' }
}

if ($Stop) { Get-Server | ForEach-Object { Stop-Process -Id $_.ProcessId }; return }

if ($Install) {
  $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Flashcards.lnk")
  $lnk.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$PSScriptRoot\flashcards.ico,0"
  $lnk.WindowStyle = 7
  $lnk.Save()
  return
}

function Test-Up {
  try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 } catch { $false }
}

# A second click while the first is still building waits here instead of building twice.
$lock = New-Object System.Threading.Mutex($false, 'FlashcardsDesktopLauncher')
try { [void]$lock.WaitOne() } catch [System.Threading.AbandonedMutexException] { } # still ours
try {
  # Rebuild even when the server is already up: preview re-reads dist/ on every request.
  $built = Get-Item dist/index.html -ErrorAction SilentlyContinue
  $newest = Get-ChildItem src, public, index.html, vite.config.ts, package-lock.json -Recurse -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $built -or $newest.LastWriteTime -gt $built.LastWriteTime) {
    npm run build *> "$env:TEMP\flashcards-build.log"
    if ($LASTEXITCODE -ne 0) {
      $msg = "The build failed, so this opens the last version that built.`nDetails: $env:TEMP\flashcards-build.log"
      if (-not (Test-Path dist/index.html)) { $msg = "The build failed and there is no earlier build to open.`nDetails: $env:TEMP\flashcards-build.log" }
      [void](New-Object -ComObject WScript.Shell).Popup($msg, 0, 'Flashcards', 48)
      if (-not (Test-Path dist/index.html)) { return }
    }
  }

  if (-not (Test-Up)) {
    Start-Process node -ArgumentList 'node_modules/vite/bin/vite.js', 'preview' -WorkingDirectory $root -WindowStyle Hidden
    for ($i = 0; $i -lt 50 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 200 }
  }
} finally {
  $lock.ReleaseMutex()
}

Start-Process msedge.exe "--app=$url"
