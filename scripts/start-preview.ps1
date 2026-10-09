param([ValidateRange(1, 65535)][int]$Port = 8877)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$previewUrl = "http://127.0.0.1:$Port/"

function Get-PreviewHealth {
    try {
        $request = [System.Net.HttpWebRequest]::Create($previewUrl + '__preview/health')
        $request.Proxy = $null
        $request.Timeout = 700
        $request.ReadWriteTimeout = 700
        $response = $request.GetResponse()
        try {
            if ($response.Headers['X-Six-Realms-Preview'] -ne '1') { return $null }
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            try { $health = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
            if ($health.service -eq 'six-realms-preview' -and $health.port -eq $Port) { return $health }
        } finally { $response.Dispose() }
    } catch { return $null }
}

$existingPreview = Get-PreviewHealth
if ($existingPreview) {
    Write-Output "Preview is already running (PID $($existingPreview.pid)): $previewUrl"
    exit 0
}

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if ($nodeCommand) {
    $nodePath = $nodeCommand.Source
} else {
    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (!(Test-Path -LiteralPath $bundledNode)) { throw 'Node.js was not found. Install Node.js or open index.html directly.' }
    $nodePath = $bundledNode
}

$logDirectory = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
# Unique log names let a failed duplicate launch leave the running server's logs intact.
$launchId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$stdoutPath = Join-Path $logDirectory "preview-$Port-$launchId.log"
$stderrPath = Join-Path $logDirectory "preview-$Port-$launchId.error.log"
$serverScript = Join-Path $PSScriptRoot 'serve.js'
$serverProcess = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $serverScript + '"'), $Port) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

for ($attempt = 0; $attempt -lt 12; $attempt++) {
    Start-Sleep -Milliseconds 250
    $serverProcess.Refresh()
    if ($serverProcess.HasExited) {
        $failureDetail = Get-Content -LiteralPath $stderrPath -Raw
        throw "Preview exited. $failureDetail Log: $stderrPath"
    }
    $health = Get-PreviewHealth
    if ($health -and $health.pid -eq $serverProcess.Id) {
        Write-Output "Preview started (PID $($health.pid)): $previewUrl"
        Write-Output "It stays running after this launcher closes. Stop it with: Stop-Process -Id $($health.pid)"
        Write-Output "Logs: $stdoutPath"
        exit 0
    }
}
throw "Preview did not respond at $previewUrl. Check $stderrPath and $stdoutPath."
