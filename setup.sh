#!/usr/bin/env bash
# Check prerequisites and install the job-seeker dependencies (macOS, Linux, Git Bash on Windows).
# Usage: ./setup.sh
set -u
cd "$(dirname "$0")"

ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✘\033[0m %s\n' "$1"; missing=1; }
missing=0

echo "Checking prerequisites..."

# Node.js 20+ (runs the web UI and the Word export)
if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -ge 20 ]; then ok "Node.js $(node --version)"; else fail "Node.js $(node --version) is too old. Install 20 or newer: https://nodejs.org"; fi
else
  fail "Node.js not found. Install 20 or newer: https://nodejs.org"
fi

# Python 3 (reads Word CVs; standard library only)
py=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(sys.version_info[0] != 3)' >/dev/null 2>&1; then py=$c; break; fi
done
if [ -n "$py" ]; then ok "Python $($py -c 'import platform; print(platform.python_version())') ($py)"; else fail "Python 3 not found. Install it: https://www.python.org/downloads/"; fi

# Claude Code CLI (runs the skill)
if command -v claude >/dev/null 2>&1; then
  ok "Claude Code $(claude --version 2>/dev/null | head -1)"
else
  fail "Claude Code not found. Install it, then run 'claude' once to log in: https://docs.claude.com/en/docs/claude-code/setup"
fi

# Google Chrome (optional: lets the skill read full job pages)
chrome=""
for p in google-chrome google-chrome-stable chromium "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/c/Program Files/Google/Chrome/Application/chrome.exe" "${LOCALAPPDATA:-/nonexistent}/Google/Chrome/Application/chrome.exe"; do
  if command -v "$p" >/dev/null 2>&1 || [ -x "$p" ]; then chrome=$p; break; fi
done
if [ -n "$chrome" ]; then ok "Google Chrome"; else warn "Google Chrome not found (optional). Without it, paste job text or rely on WebFetch: https://www.google.com/chrome/"; fi

if [ "$missing" -ne 0 ]; then
  echo; echo "Install the missing items above, then run ./setup.sh again."; exit 1
fi

echo; echo "Installing the skill's dependencies..."
npm install --prefix .claude/skills/job-seeker --no-fund --no-audit || { echo "npm install failed."; exit 1; }

echo; echo "Running the self-check..."
node web/server.test.js || exit 1

cat <<'EOF'

Setup complete.

Next:
  1. Optional: run 'claude' in this folder, type /mcp, and approve 'chrome-devtools'
     so job pages are read in a real browser.
  2. Start the web UI:  ./start.sh   (then open http://localhost:3000)
EOF
