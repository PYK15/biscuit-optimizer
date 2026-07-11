# One-command demo launcher for Windows PowerShell.
# Double-click "Start Biscuit Dashboard.bat" instead of running this directly
# if you just want to use the app - it wraps this script and keeps the
# window open so you can read any error.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$ApiPort = 8000
$WebPort = 5173
$ApiUrl = "http://localhost:$ApiPort/docs"
$WebUrl = "http://localhost:$WebPort"

# --- Helpers ---------------------------------------------------------------

function Stop-ProcessTree {
    param([int]$ProcessId)
    try {
        & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
    } catch {}
}

function Stop-StaleProcessOnPort {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    } catch {
        return
    }
    if (-not $conns) { return }
    foreach ($procId in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if (-not $proc) { continue }
        if ($proc.ProcessName -in @("python", "node")) {
            Write-Output "Port $Port is held by a leftover process from a previous run ($($proc.ProcessName), PID $procId) - stopping it."
            Stop-ProcessTree -ProcessId $procId
            Start-Sleep -Milliseconds 500
        } else {
            Write-Warning "Port $Port is in use by an unrelated process ($($proc.ProcessName), PID $procId). Close it and re-run if startup fails."
        }
    }
}

function Wait-ForHttp {
    param([string]$Url, [int]$TimeoutSec)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { return $true }
        } catch {}
        Start-Sleep -Seconds 1
    }
    return $false
}

# --- Pre-flight: clear any orphaned process from a previous run ------------

Stop-StaleProcessOnPort -Port $ApiPort
Stop-StaleProcessOnPort -Port $WebPort

# --- Setup (unchanged business logic) ---------------------------------------

if (-not (Test-Path .venv)) {
    python -m venv .venv
}
.\.venv\Scripts\python.exe -m pip install -q -r requirements.txt

Write-Output "== Data validation summary =="
.\.venv\Scripts\python.exe -m data.loader

Write-Output "== Model backtest scorecard =="
.\.venv\Scripts\python.exe -m models.forecaster

if (-not (Test-Path frontend\node_modules)) {
    Push-Location frontend
    npm install
    Pop-Location
}

# --- Launch both services, capturing real process handles ------------------

Write-Output "== Starting API on :$ApiPort =="
$apiProc = Start-Process -FilePath .\.venv\Scripts\python.exe `
    -ArgumentList "-m uvicorn api.main:app --port $ApiPort --log-level warning" `
    -NoNewWindow -PassThru

Write-Output "== Starting frontend on :$WebPort =="
$webProc = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "dev", "--", "--port", "$WebPort" `
    -WorkingDirectory ".\frontend" -NoNewWindow -PassThru

try {
    Write-Output "Waiting for backend to become ready..."
    if (-not (Wait-ForHttp -Url $ApiUrl -TimeoutSec 90)) {
        Write-Error "Backend did not become ready within 90s. Scroll up for the actual error."
        exit 1
    }

    Write-Output "Waiting for frontend to become ready..."
    if (-not (Wait-ForHttp -Url $WebUrl -TimeoutSec 60)) {
        Write-Error "Frontend did not become ready within 60s. Scroll up for the actual error."
        exit 1
    }

    Write-Output "Both services are ready - opening the dashboard..."
    Start-Process $WebUrl

    Write-Output ""
    Write-Output "Dashboard running at $WebUrl (API at http://localhost:$ApiPort)."
    Write-Output "Press Ctrl+C or close this window to stop everything."

    while ($true) {
        Start-Sleep -Seconds 2
        if ($apiProc.HasExited) { Write-Warning "Backend process exited unexpectedly."; break }
        if ($webProc.HasExited) { Write-Warning "Frontend process exited unexpectedly."; break }
    }
}
finally {
    Write-Output "Shutting down..."
    if ($apiProc -and -not $apiProc.HasExited) { Stop-ProcessTree -ProcessId $apiProc.Id }
    if ($webProc -and -not $webProc.HasExited) { Stop-ProcessTree -ProcessId $webProc.Id }
    Write-Output "Stopped."
}
