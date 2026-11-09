#!/usr/bin/env bash
# Start the job-seeker web UI. Usage: ./start.sh   (PORT=4000 ./start.sh for another port)
cd "$(dirname "$0")"
if [ ! -d .claude/skills/job-seeker/node_modules ]; then
  echo "Dependencies are not installed. Run ./setup.sh first."; exit 1
fi
exec node web/server.js
