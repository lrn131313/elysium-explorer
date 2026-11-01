#!/usr/bin/env bash
# Builds the Nitro command line from environment variables (see .env).
# Any argument passed to the container is appended, so it can override a flag.
set -euo pipefail

# Provide YOUR OWN Elysium endpoints in node/.env — the node refuses to start without them.
# Do not reuse anyone else's RPC/sequencer/DAS. See node/.env.example.
: "${PARENT_CHAIN_RPC:?PARENT_CHAIN_RPC is required (parent-chain RPC the node reads; the proxy serves it), see node/.env.example}"
: "${FORWARDING_TARGET:?FORWARDING_TARGET is required (your Elysium sequencer RPC), see node/.env.example}"
: "${SEQUENCER_FEED_RELAY:?SEQUENCER_FEED_RELAY is required (your Elysium sequencer feed), see node/.env.example}"
: "${DAS_URL:?DAS_URL is required (your Elysium AnyTrust DAS endpoint), see node/.env.example}"
NODE_MODE="${NODE_MODE:-archive}"
RPC_API="${RPC_API:-net,web3,eth}"
PARENT_CHAIN_MAX_BLOCKS_TO_READ="${PARENT_CHAIN_MAX_BLOCKS_TO_READ:-1000}"
PARENT_CHAIN_RETRY_ERRORS='websocket: close.*|dial tcp .*|.*i/o timeout|.*connection reset by peer|.*connection refused|.*Temporary internal error.*|.*invalid block range.*|.*invalid block height.*|.*no available upstreams.*|.*429.*|.*rate limit.*|.*502.*|.*503.*|.*504.*'

args=(
  --conf.file=/config/chainInfo.json
  --node.staker.enable=false

  # L2: transactions are forwarded to the Conduit sequencer, new blocks come from its feed
  --execution.forwarding-target="$FORWARDING_TARGET"
  --node.feed.input.url="$SEQUENCER_FEED_RELAY"

  # L1 (parent chain) is HyperEVM
  --parent-chain.connection.url="$PARENT_CHAIN_RPC"
  --parent-chain.connection.retries=10
  --parent-chain.connection.retry-delay=500ms
  --parent-chain.connection.retry-errors="$PARENT_CHAIN_RETRY_ERRORS"
  # HyperEVM RPCs cap eth_getLogs at 1000 blocks (Nitro reads up to 2000 by default)
  --node.inbox-reader.max-blocks-to-read="$PARENT_CHAIN_MAX_BLOCKS_TO_READ"
  # HyperEVM has no EIP-4844 blobs: Elysium posts its data to an AnyTrust DAS
  --node.dangerous.disable-blob-reader
  --node.data-availability.enable
  --node.data-availability.rest-aggregator.enable
  --node.data-availability.rest-aggregator.urls="$DAS_URL"

  # JSON-RPC over HTTP (8547) and WebSocket (8546)
  --http.addr=0.0.0.0
  --http.port=8547
  --http.api="$RPC_API"
  --http.corsdomain=*
  --http.vhosts=*
  --ws.addr=0.0.0.0
  --ws.port=8546
  --ws.api="$RPC_API"
  --ws.origins=*

  # Prometheus metrics on 6070 (/debug/metrics/prometheus)
  --metrics
  --metrics-server.addr=0.0.0.0
  --metrics-server.port=6070
)

# Optional cache sizes in MB for small machines (the AWS box); unset keeps Nitro's defaults (database 2048,
# trie-clean 600, snapshot 400, trie-dirty 1024), which grew the node to ~1 GB RSS within a day.
[[ -n "${CACHE_DATABASE_MB:-}" ]] && args+=(--execution.caching.database-cache="$CACHE_DATABASE_MB")
[[ -n "${CACHE_TRIE_CLEAN_MB:-}" ]] && args+=(--execution.caching.trie-clean-cache="$CACHE_TRIE_CLEAN_MB")
[[ -n "${CACHE_SNAPSHOT_MB:-}" ]] && args+=(--execution.caching.snapshot-cache="$CACHE_SNAPSHOT_MB")
[[ -n "${CACHE_TRIE_DIRTY_MB:-}" ]] && args+=(--execution.caching.trie-dirty-cache="$CACHE_TRIE_DIRTY_MB")

case "$NODE_MODE" in
  archive) args+=(--execution.caching.archive) ;;
  full) ;;
  *) echo "NODE_MODE must be 'archive' or 'full' (got '$NODE_MODE')" >&2; exit 1 ;;
esac

echo "Starting Elysium node (mode=$NODE_MODE, parent chain=${PARENT_CHAIN_RPC%%\?*})"
exec /usr/local/bin/nitro "${args[@]}" "$@"
