param([switch]$SeedDemo)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pythonExe = Join-Path $projectRoot 'backend/.venv/Scripts/python.exe'
$viteExe = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Falta backend/.venv. Instala las dependencias de backend antes de iniciar el entorno.'
}
if (-not (Test-Path -LiteralPath $viteExe)) {
    throw 'Falta frontend/node_modules. Ejecuta npm ci dentro de frontend.'
}

function Test-Port([int]$port) {
    $connection = [System.Net.Sockets.TcpClient]::new()
    try {
        $result = $connection.BeginConnect('127.0.0.1', $port, $null, $null)
        if (-not $result.AsyncWaitHandle.WaitOne(500)) { return $false }
        $connection.EndConnect($result)
        return $true
    } catch {
        return $false
    } finally {
        $connection.Dispose()
    }
}

if (-not (Test-Port 8001)) {
    Start-Process -FilePath $pythonExe -ArgumentList (Join-Path $projectRoot 'backend/scripts/dev_sandbox.py') `
        -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
}
if (-not (Test-Port 5173)) {
    Start-Process -FilePath (Join-Path $env:ProgramFiles 'nodejs/node.exe') `
        -ArgumentList @($viteExe, '--host', '127.0.0.1', '--port', '5173', '--strictPort') `
        -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden | Out-Null
}

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
        $api = Invoke-RestMethod -Uri 'http://127.0.0.1:8001/' -TimeoutSec 2
        $page = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2 -UseBasicParsing
        if ($api.status -eq 'healthy' -and $api.app -eq 'AiProces Backend' -and
            $page.StatusCode -eq 200 -and $page.Content -match '<title>AiProces') {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'El entorno no respondió en localhost:8001 y localhost:5173.' }

if ($SeedDemo) {
    & $pythonExe (Join-Path $projectRoot 'backend/scripts/seed_sandbox.py')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el proceso de ejemplo.' }
}

Write-Host 'AiProces de prueba: http://127.0.0.1:5173/'
Write-Host 'Cuenta local: sandbox@local.test / SandboxDePrueba123'
Write-Host 'Datos: backend/sandbox.db (aislados de producción)'
