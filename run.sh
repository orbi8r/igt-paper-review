#!/bin/bash
# Stops whatever holds the presenter port, then starts the server in the foreground.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8787}"
pids=$(ss -ltnp "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
if [ -n "$pids" ]; then
  echo "stopping old server on port $PORT (pid $pids)"
  kill $pids 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    ss -ltn "sport = :$PORT" 2>/dev/null | grep -q LISTEN || break
    sleep 0.3
  done
  ss -ltn "sport = :$PORT" 2>/dev/null | grep -q LISTEN && kill -9 $pids 2>/dev/null && sleep 0.5
fi
exec node server.js
