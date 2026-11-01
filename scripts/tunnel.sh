#!/bin/bash
# Forwards the explorer's container ports from the colima VM to the Mac's 127.0.0.1.
#
# Why this exists: on 2026-10-31 colima's own port forwarder failed for every NEW published port
# (`ssh -O forward ... exit status 255` in ~/.colima/_lima/colima/ha.stderr.log) while the ports it had
# forwarded earlier kept working. Restarting colima would fix it but also restarts every other container
# (the Elysium node the local app reads from), so this opens a separate SSH session to the VM instead:
# its own connection (ControlPath=none), so it never touches colima's control master.
#
# Usage: scripts/tunnel.sh [start|stop|status]   (idempotent; start is a no-op if already up)
set -euo pipefail

PORTS=(9547 9546 9555 9070 4010)
CFG="$HOME/.colima/_lima/colima/ssh.config"
TAG="elysium-explorer-tunnel"

pids() { pgrep -f "ssh .*-o SetEnv=TUNNEL=$TAG" || true; }

case "${1:-start}" in
  start)
    if [ -n "$(pids)" ]; then echo "tunnel already up (pid $(pids | tr '\n' ' '))"; exit 0; fi
    args=()
    for p in "${PORTS[@]}"; do args+=(-L "127.0.0.1:$p:127.0.0.1:$p"); done
    ssh -F "$CFG" -o ControlPath=none -o ControlMaster=no -o ExitOnForwardFailure=yes \
      -o ServerAliveInterval=15 -o ServerAliveCountMax=4 -o "SetEnv=TUNNEL=$TAG" \
      -N -f "${args[@]}" lima-colima
    echo "tunnel up (pid $(pids | tr '\n' ' ')): ${PORTS[*]}"
    ;;
  stop)
    p=$(pids); [ -z "$p" ] && { echo "tunnel not running"; exit 0; }
    kill $p && echo "tunnel stopped"
    ;;
  status)
    p=$(pids); [ -z "$p" ] && { echo "tunnel not running"; exit 1; }
    echo "tunnel up (pid $(echo $p | tr '\n' ' ')): ${PORTS[*]}"
    ;;
  *) echo "usage: $0 [start|stop|status]" >&2; exit 2 ;;
esac
