# Start the job-seeker web UI. Usage: .\start.ps1   (another port: $env:PORT = 4000; .\start.ps1)
Set-Location $PSScriptRoot
if (-not (Test-Path .claude/skills/job-seeker/node_modules)) {
  Write-Host "Dependencies are not installed. Run .\setup.ps1 first."; exit 1
}
node web/server.js
