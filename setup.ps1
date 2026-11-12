# Check prerequisites and install the job-seeker dependencies (Windows PowerShell 5.1+ or PowerShell 7).
# Usage: .\setup.ps1   (if blocked: powershell -ExecutionPolicy Bypass -File .\setup.ps1)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$missing = $false
function Ok($m)   { Write-Host "  [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [x]  $m" -ForegroundColor Red; $script:missing = $true }
function Has($c)  { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Write-Host "Checking prerequisites..."

# Node.js 20+ (runs the web UI and the Word export)
if (Has node) {
  $v = (node --version).Trim()
  if ([int]($v.TrimStart('v').Split('.')[0]) -ge 20) { Ok "Node.js $v" } else { Fail "Node.js $v is too old. Install 20 or newer: winget install OpenJS.NodeJS.LTS" }
} else { Fail "Node.js not found. Install 20 or newer: winget install OpenJS.NodeJS.LTS" }

# Python 3 (reads Word CVs; standard library only). Skips the Microsoft Store placeholder.
$py = $null
foreach ($c in 'python', 'python3', 'py') {
  if (Has $c) {
    try { $out = & $c -c "import sys; print(sys.version.split()[0]) if sys.version_info[0] == 3 else sys.exit(1)" 2>$null } catch { $out = $null }
    if ($LASTEXITCODE -eq 0 -and $out) { $py = $c; Ok "Python $out ($c)"; break }
  }
}
if (-not $py) { Fail "Python 3 not found. Install it: winget install Python.Python.3.12" }
elseif ($py -eq 'py') { Warn "Only the 'py' launcher was found. The skill calls 'python'; reinstall Python with 'Add to PATH' checked." }

# Claude Code CLI (runs the skill)
if (Has claude) { Ok "Claude Code $((claude --version | Select-Object -First 1))" }
else { Fail "Claude Code not found. Install it, then run 'claude' once to log in: https://docs.claude.com/en/docs/claude-code/setup" }

# Google Chrome (optional: lets the skill read full job pages)
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($chrome) { Ok "Google Chrome" } else { Warn "Google Chrome not found (optional). Without it, paste job text or rely on WebFetch: winget install Google.Chrome" }

if ($missing) { Write-Host "`nInstall the missing items above, then run .\setup.ps1 again."; exit 1 }

Write-Host "`nInstalling the skill's dependencies..."
npm install --prefix .claude/skills/job-seeker --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed."; exit 1 }

Write-Host "`nRunning the self-check..."
node web/server.test.js
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host @"

Setup complete.

Next:
  1. Optional: run 'claude' in this folder, type /mcp, and approve 'chrome-devtools'
     so job pages are read in a real browser.
  2. Start the web UI:  .\start.ps1   (then open http://localhost:3030)
"@
