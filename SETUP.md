# Setup

This is a self-hosted, Etherscan-style explorer for **Elysium** (chain 99901, an Arbitrum Orbit chain on
HyperEVM, gas coin HYPE). Three parts: your own Nitro archive node, Blockscout v12.0.3 as the indexer/API,
and a Next.js UI. Everything binds to `127.0.0.1` by default.

**You bring your own endpoints.** Nothing in this repo points at anyone else's node, sequencer or DAS — the
real env files are not committed; you copy the `.example` files and fill in your own. The node will not start
until you do.

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ and `pnpm`
- Your own access to Elysium: a sequencer RPC, the sequencer feed (ws), a DAS endpoint, and HyperEVM
  (parent-chain) RPC URLs.

## 1. Configuration (copy the examples, fill in your values)

```bash
cp .env.example .env                      # PARENT_UPSTREAMS = your HyperEVM RPC URLs
cp node/.env.example node/.env            # your FORWARDING_TARGET / SEQUENCER_FEED_RELAY / DAS_URL
cp web/.env.local.example web/.env.local  # defaults are fine for a local run
cp backend/secrets.env.example backend/secrets.env
```

Generate fresh backend secrets into `backend/secrets.env`:

```bash
openssl rand -hex 24   # -> POSTGRES_PASSWORD (also paste it into DATABASE_URL)
openssl rand -hex 32   # -> SECRET_KEY_BASE
```

## 2. Build the Blockscout engine image

Blockscout v10+ images are not published, so build from the tagged source (not included in this repo):

```bash
git clone --branch v12.0.3 https://github.com/blockscout/blockscout backend/src
cd backend/src
docker build -f docker/Dockerfile \
  --build-arg CHAIN_TYPE=arbitrum \
  --build-arg RELEASE_VERSION=12.0.3 \
  --build-arg BLOCKSCOUT_VERSION=v12.0.3 \
  -t elysium-explorer-blockscout:12.0.3-arbitrum .
cd ../..
```

## 3. Start the backend stack

```bash
docker-compose up -d              # node, parent-proxy, db, backend
# scripts/tunnel.sh start         # only if your Docker runtime drops newly published ports (see README)
```

The node syncs Elysium from genesis by reading batches from HyperEVM, and Blockscout indexes as it goes. The
first full sync takes a while. (If someone hands you a pre-built Postgres dump, you can restore it into the
`explorer-db` volume to skip the initial sync — it is only public chain data.)

## 4. Run the UI

```bash
cd web
pnpm install --frozen-lockfile
pnpm build
pnpm start                        # http://127.0.0.1:4020
```

## Chain identity

This is wired for Elysium out of the box — chain id `99901`, coin `HYPE`, parent chain HyperEVM (`999`), and
the Elysium rollup/bridge contracts in `node/config/chainInfo.json` and `backend/blockscout.env`. All of that
is public on-chain information. If you ever point this at a different chain, change those values too.

## Before exposing it publicly

See the "Before going public" section of [ROADMAP.md](ROADMAP.md): turn API rate limiting back on
(`API_RATE_LIMIT_DISABLED` in `backend/blockscout.env`), cap CSV export, bound per-address counting, and note
that the "broadcast signed transaction" page forwards to the real sequencer.
