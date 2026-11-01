# Elysium Explorer (working title)

An Etherscan-style block explorer for Elysium (chain 99901, Arbitrum Orbit on HyperEVM, gas token HYPE).
Own name, logo and code; the look follows Etherscan's layout. Nothing here belongs to Etherscan.

> **First time here? Read [SETUP.md](SETUP.md).** It lists exactly which endpoints to fill in with your own
> (nothing ships pointing at anyone else's node) and how to build and run the stack. The roadmap of done /
> remaining features is in [ROADMAP.md](ROADMAP.md).

```
browser ──> web (Next.js, :4020) ──> Blockscout API v2 (:4010) ──> Postgres
                                 └─> explorer-node RPC (:9547, safe/finalized tags)
Blockscout indexer ──> explorer-node (own Nitro archive node) ──> parent-proxy (:9555) ──> HyperEVM RPCs
```

## Pieces

| Service | What it is | Host port |
|---|---|---|
| `explorer-parent-proxy` | sticky-failover proxy over the HyperEVM RPCs in `.env` (`PARENT_UPSTREAMS`) | 9555 |
| `explorer-node` | Nitro archive node for Elysium, built from `node/` (debug API on, for internal txs) | 9547 http, 9546 ws, 9070 metrics |
| `explorer-db` | Postgres 17 for Blockscout (not published) | - |
| `explorer-backend` | Blockscout v12.0.3, `CHAIN_TYPE=arbitrum`, built from source in `backend/src` | 4010 |
| `web/` | the explorer UI (Next.js 16, server components, Bootstrap 5 + own theme) | 4020 |

All ports bind to 127.0.0.1 only.

## Run

```bash
docker-compose up -d            # node, proxy, db, backend
scripts/tunnel.sh start         # see "Ports on colima" below
cd web && pnpm install --frozen-lockfile && pnpm build && pnpm start   # http://127.0.0.1:4020
```

`web/.env.local` points the UI at `BLOCKSCOUT_API_URL=http://127.0.0.1:4010/api/v2` and `NODE_RPC_URL=http://127.0.0.1:9547`.

## Ports on colima

If your Docker runtime (e.g. colima) stops forwarding newly published ports (`ssh -O forward ... exit 255`),
restarting it would fix it but also restart every other container. `scripts/tunnel.sh` opens its own SSH
session to the VM instead (`start|stop|status`). Re-run `start` after a reboot. On plain Docker Desktop you
usually do not need this.

## Rebuilding the backend image

v10+ Blockscout images are not public, so the image is built from the tagged source:

```bash
cd backend/src   # git clone --branch v12.0.3 https://github.com/blockscout/blockscout
docker build -f docker/Dockerfile --build-arg CHAIN_TYPE=arbitrum --build-arg RELEASE_VERSION=12.0.3 \
  --build-arg BLOCKSCOUT_VERSION=v12.0.3 -t elysium-explorer-blockscout:12.0.3-arbitrum .
```

`backend/secrets.env` (DB password, `DATABASE_URL`, `SECRET_KEY_BASE`) is generated locally, mode 600, never committed.
v12 uses `ECTO_SSL_MODE=disable` (the old `ECTO_USE_SSL` is ignored).

## Names shown for addresses

Order, as on Etherscan: our name tag, Blockscout public tag, verified contract name, ENS name.

- **Name tags** (`web/data/labels.json`): hand-curated Elysium contracts (launchpads, factories, routers, WHYPEs),
  each confirmed on-chain in the owner's research notes. Add an address only with a source.
- **Pools** (`web/lib/labels.ts`): every `PoolCreated` log of each `v3-factory` entry is read from our node and named
  `<Project>: TOKEN/WHYPE 1%`. New pools are picked up at most once a minute, no restart needed.
- **ENS**: Blockscout resolves primary names through the public BENS service (`MICROSERVICE_BENS_*` in
  `backend/blockscout.env`, multiprotocol mode with `ens`). Search by `name.eth` works.
- Etherscan's own label database is not used: it is their proprietary data (their terms forbid scraping it) and it
  has no Elysium addresses anyway.

## Known behaviour

- **Fresh sync.** The node syncs from genesis by reading batches from HyperEVM; Blockscout indexes as it goes.
- **Sync speed.** Nitro fetches the parent-block header of every delayed message one request at a time, and Elysium
  has about one delayed message per HyperEVM block. The proxy prefetches those headers in parallel batches whenever
  an `eth_getLogs` answer passes through and serves the node's header requests from memory (`headerCache` on the
  :9555 status page). Without it the sync ran at one batch every 5-11 minutes. After editing `proxy.mjs`, recreate
  the proxy (`docker-compose up -d --no-deps --force-recreate explorer-parent-proxy`): a single-file bind mount
  can keep showing the old copy across a plain `restart` when an editor replaced the file instead of editing it.
- **14-day chart.** Blockscout counts each day once, at backend start (`TXS_STATS_DAYS_TO_COMPILE_AT_INIT`,
  default 40 days), then only the last 2 days each midnight UTC. Days counted while the node was still behind
  stay at 0. After the first full sync, restart only the backend: `docker-compose restart explorer-backend`.
- **Before going public:** turn API rate limiting back on (`API_RATE_LIMIT_DISABLED=true` in `backend/blockscout.env`).
- Arbitrum batch / bridge-message tracking is off for now (`INDEXER_ARBITRUM_BATCHES_TRACKING_ENABLED=false`).
