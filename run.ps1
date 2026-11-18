<#
  Runs the whole demo stack locally: Postgres :5433 -> seed data -> API :8000 -> web :5173.

    .\run.cmd                  start everything (builds seed data only if missing or out of date)
    .\run.cmd -Reseed          rebuild embeddings, sample HCPs and clusters, then start
    .\run.cmd -Reseed -Media   also re-run the video pipeline (narration, captions, posters; ~12 min)
    .\run.cmd -Test            run the test suite before starting
    .\run.cmd -Stop            stop the API, the web app and Postgres

  Every start reloads the seed into Postgres, so each rehearsal begins from the same clean state.
#>
param([switch]$Reseed, [switch]$Media, [switch]$Test, [switch]$Stop, [switch]$NoBrowser)

$ErrorActionPreference = "Continue"   # native tools report through exit codes, checked below
$root   = $PSScriptRoot
$local  = Join-Path $root ".local"
$pgBin  = Join-Path $local "pgsql\bin"
$pgData = Join-Path $local "data"
$logs   = Join-Path $local "logs"
$pids   = Join-Path $local "run.pids"
$api    = Join-Path $root "api"
$web    = Join-Path $root "web"
$env:PYTHONIOENCODING = "utf-8"

function Step($msg) { Write-Host "`n> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "x $msg" -ForegroundColor Red; exit 1 }

function Stop-Stack {
  if (Test-Path $pids) {
    foreach ($p in Get-Content $pids) { if ($p) { cmd /c "taskkill /T /F /PID $p >nul 2>&1" } }
    Remove-Item $pids -Force
  }
  # anything else still holding the demo ports (e.g. a server started by hand)
  foreach ($port in 8000, 5173) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      ForEach-Object { cmd /c "taskkill /T /F /PID $($_.OwningProcess) >nul 2>&1" }
  }
}

function Wait-Url($url, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { Start-Sleep -Milliseconds 500 }
  }
  return $false
}

if ($Stop) {
  Step "Stopping API and web"
  Stop-Stack
  if (Test-Path (Join-Path $pgBin "pg_ctl.exe")) {
    Step "Stopping Postgres"
    & (Join-Path $pgBin "pg_ctl.exe") -D $pgData stop -m fast *> $null
  }
  Write-Host "Stopped." -ForegroundColor Green
  exit 0
}

# ---- prerequisites --------------------------------------------------------------------------
if (-not (Test-Path (Join-Path $pgBin "pg_ctl.exe"))) { Fail "Portable Postgres not found in .local\pgsql (see README: First-time setup)." }
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Fail "uv not found: winget install astral-sh.uv" }
Step "Python environment (uv)"
Push-Location $api; uv sync --locked --quiet; $ok = $LASTEXITCODE -eq 0; Pop-Location
if (-not $ok) { Fail "uv sync failed." }
Write-Host "  in sync"
if (-not (Test-Path (Join-Path $web "node_modules"))) { Step "Installing web dependencies"; Push-Location $web; npm ci; Pop-Location }
New-Item -ItemType Directory -Force $logs | Out-Null
Stop-Stack   # a previous run left open

# ---- Postgres -------------------------------------------------------------------------------
Step "Postgres :5433"
if (-not (Test-Path (Join-Path $pgData "PG_VERSION"))) {
  & (Join-Path $pgBin "initdb.exe") -D $pgData -U demo -A trust -E UTF8 | Out-Null
}
& (Join-Path $pgBin "pg_ctl.exe") -D $pgData status *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin "pg_ctl.exe") -D $pgData -l (Join-Path $logs "postgres.log") -o "-p 5433" -w start | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "Postgres did not start; see .local\logs\postgres.log" }
}
$exists = & (Join-Path $pgBin "psql.exe") -h 127.0.0.1 -p 5433 -U demo -d postgres -tAc "select 1 from pg_database where datname='hcp'"
if (-not $exists) { & (Join-Path $pgBin "createdb.exe") -h 127.0.0.1 -p 5433 -U demo hcp }
Write-Host "  running"

# ---- seed data ------------------------------------------------------------------------------
$art = Join-Path $api "data\artifacts"
$needed = "item_embeddings.npy", "synthetic.json", "clusters.json", "behaviour_X.npy" | ForEach-Object { Join-Path $art $_ }
$missing = @($needed | Where-Object { -not (Test-Path $_) }).Count -gt 0
$stale = $false
if (-not $missing) {
  $cat = Join-Path $api "data\catalogue.json"
  $stale = (Test-Path $cat) -and ((Get-Item $cat).LastWriteTime -gt (Get-Item $needed[0]).LastWriteTime)
}
if (-not (Test-Path (Join-Path $api "data\media_manifest.json"))) { $Media = $true; $Reseed = $true }

Push-Location $api
try {
  if ($Reseed -or $missing -or $stale) {
    $why = if ($Reseed) { "requested" } elseif ($missing) { "artifacts missing" } else { "catalogue changed since last build" }
    Step "Building seed data ($why)"
    if ($Media) { uv run --no-sync python -m seed } else { uv run --no-sync python -m seed --skip-media }
  } else {
    Step "Loading seed data into Postgres"
    uv run --no-sync python -m seed --load-only
  }
  if ($LASTEXITCODE -ne 0) { Fail "Seed failed." }

  if ($Test) {
    Step "Running tests"
    uv run --no-sync python -m pytest -q
    if ($LASTEXITCODE -ne 0) { Fail "Tests failed; stack not started." }
  }
} finally { Pop-Location }

# ---- API and web ----------------------------------------------------------------------------
Step "API :8000"
$apiProc = Start-Process powershell -PassThru -WorkingDirectory $api -ArgumentList "-NoExit", "-Command",
  "`$host.UI.RawUI.WindowTitle='Demo API :8000'; `$env:PYTHONIOENCODING='utf-8'; uv run --no-sync python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
$apiProc.Id | Set-Content $pids
if (-not (Wait-Url "http://127.0.0.1:8000/api/v1/health" 60)) { Fail "API did not respond; check the 'Demo API' window." }
Write-Host "  healthy"

Step "Web :5173"
$webProc = Start-Process powershell -PassThru -WorkingDirectory $web -ArgumentList "-NoExit", "-Command",
  "`$host.UI.RawUI.WindowTitle='Demo web :5173'; npx vite --port 5173 --strictPort"
$webProc.Id | Add-Content $pids
if (-not (Wait-Url "http://localhost:5173" 60)) { Fail "Web app did not respond; check the 'Demo web' window." }
Write-Host "  ready"

Write-Host ""
Write-Host "Demo     http://localhost:5173" -ForegroundColor Green
Write-Host "API      http://127.0.0.1:8000/api/v1/health"
Write-Host "Stop     .\run.cmd -Stop"
if (-not $NoBrowser) { Start-Process "http://localhost:5173" }
