// Sticky-failover JSON-RPC proxy in front of the HyperEVM (parent chain) RPCs, so one provider's rate limit or
// outage never stalls the Elysium node. Zero dependencies (Node 22).
//
// Sticky, not round-robin: providers can be a block apart, and the node pairs "latest" with eth_getLogs ranges, so
// every request goes to ONE provider until it fails. After FAILBACK_MS on a fallback it retries the primary.
//
// All UPSTREAMS must index HyperEVM block transactions the same way (all excluding the HyperCore system txs, like
// rpc.hyperliquid.xyz/evm). Mixing styles makes nitro fetch the wrong batch tx ("unexpected transaction hash").
//
// Header prefetch: for every delayed message nitro asks for its parent block's header on its own, one request at a
// time (eth_getBlockByHash in arbnode/delayed.go logsToDeliveredMessages). Elysium has about one delayed message per
// HyperEVM block, so at ~0.27 s a request a 1000-block window cost over a minute and the sync crawled at one batch
// every 5-11 minutes. When an eth_getLogs answer passes through, the proxy fetches the headers of the blocks in it in
// parallel batches before handing the logs over, then answers nitro's follow-up header requests from memory. A block
// hash names one block forever, so a remembered header never goes stale.
//
// Plain path: the explorer backend (Blockscout's Arbitrum trackers) posts to PLAIN_PATH. Its eth_getLogs answers hold
// hundreds of delayed messages it never asks headers for, so prefetching them only multiplied requests; on 2026-11-01
// that pushed every provider into HTTP 429 at once. Plain requests get the same failover, without the prefetch.
import http from 'node:http'

const UPSTREAMS = (process.env.UPSTREAMS ?? '').split(',').map((u) => u.trim()).filter(Boolean)
if (UPSTREAMS.length === 0) throw new Error('UPSTREAMS must list at least one HyperEVM RPC URL')
const PORT = Number(process.env.PORT ?? 8545)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 15000)
const FAILBACK_MS = Number(process.env.FAILBACK_MS ?? 300000)
const HEADER_BATCH = Number(process.env.HEADER_BATCH ?? 20) // rpc.hypurrscan.io refuses JSON-RPC batches above 20
const HEADER_PARALLEL = Number(process.env.HEADER_PARALLEL ?? 4)
const HEADER_CACHE_MAX = Number(process.env.HEADER_CACHE_MAX ?? 5000) // a 1000-block window needs at most 1000
const PLAIN_PATH = '/plain'

const RATE_LIMITED = /rate.?limit|too many|exceeded|capacity/i
// rpc.hypurrscan.io and pocket answer eth_getLogs over older blocks with "invalid block range" (pruned history,
// seen 2026-10-25), which stalled the inbox reader on them; another provider has that range, so it is a refusal too.
const NO_HISTORY = /invalid block range/i
const host = (u) => new URL(u).host

let current = 0
let switchedAt = 0
const stats = UPSTREAMS.map(() => ({ ok: 0, failed: 0 }))

const log = (m) => console.log(`${new Date().toISOString()} ${m}`)

// A response is unusable if the provider refused it as a whole or any batch element is a rate-limit error.
function refusal(status, text) {
  if (status === 429 || status >= 500) return `HTTP ${status}`
  let body
  try {
    body = JSON.parse(text)
  } catch {
    return `non-JSON HTTP ${status}` // a provider error page, not a JSON-RPC answer
  }
  for (const r of Array.isArray(body) ? body : [body]) {
    if (r?.error && RATE_LIMITED.test(String(r.error.message))) return `rate limited: ${r.error.message}`
    if (r?.error && NO_HISTORY.test(String(r.error.message))) return `no history: ${r.error.message}`
  }
  return null
}

async function forward(body) {
  if (current !== 0 && Date.now() - switchedAt > FAILBACK_MS) {
    log(`failback: retrying primary ${host(UPSTREAMS[0])}`)
    current = 0
  }
  const reasons = []
  for (let n = 0; n < UPSTREAMS.length; n++) {
    const i = (current + n) % UPSTREAMS.length
    try {
      const res = await fetch(UPSTREAMS[i], {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const text = await res.text()
      const why = refusal(res.status, text)
      if (why) throw new Error(why)
      stats[i].ok++
      if (i !== current) {
        log(`switch ${host(UPSTREAMS[current])} -> ${host(UPSTREAMS[i])} (${reasons.join('; ')})`)
        current = i
        switchedAt = Date.now()
      }
      return { status: res.status, text }
    } catch (e) {
      stats[i].failed++
      reasons.push(`${host(UPSTREAMS[i])}: ${e.message}`)
    }
  }
  // Every provider refused: answer 503 so nitro's retry-errors pattern (.*503.*) backs off and retries.
  log(`all upstreams failed: ${reasons.join('; ')}`)
  return { status: 503, text: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: `503 all parent RPCs failed` } }) }
}

const headers = new Map() // lower-case block hash -> JSON text of eth_getBlockByHash(hash, false).result
const headerStats = { prefetched: 0, hits: 0, plainRequests: 0 }

function remember(hash, resultJson) {
  if (headers.size >= HEADER_CACHE_MAX) headers.delete(headers.keys().next().value) // oldest first
  headers.set(hash, resultJson)
}

async function prefetchHeaders(logs) {
  const hashes = new Set()
  for (const l of logs) if (typeof l.blockHash === 'string') hashes.add(l.blockHash.toLowerCase())
  const wanted = [...hashes].filter((h) => !headers.has(h))
  const chunks = []
  for (let i = 0; i < wanted.length; i += HEADER_BATCH) chunks.push(wanted.slice(i, i + HEADER_BATCH))
  let next = 0
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++]
      const batch = chunk.map((h, id) => ({ jsonrpc: '2.0', id, method: 'eth_getBlockByHash', params: [h, false] }))
      const { text } = await forward(Buffer.from(JSON.stringify(batch)))
      const replies = JSON.parse(text)
      if (!Array.isArray(replies)) throw new Error(`header batch answered ${text.slice(0, 200)}`)
      for (const r of replies) {
        const h = chunk[r.id]
        // Only a real header for the hash asked is kept; a null (provider has not seen the block) is left to nitro.
        if (h !== undefined && r.result && typeof r.result.hash === 'string' && r.result.hash.toLowerCase() === h) {
          remember(h, JSON.stringify(r.result))
          headerStats.prefetched++
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(HEADER_PARALLEL, chunks.length) }, worker))
}

async function handle(body, plain) {
  let call
  try {
    call = JSON.parse(body)
  } catch (e) {
    // Not JSON-RPC at all (nitro never sends this): answer with the protocol's parse error instead of forwarding it.
    return { status: 200, text: JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: `parse error: ${e.message}` } }) }
  }
  if (plain) {
    headerStats.plainRequests++
    return forward(body)
  }
  const single = call !== null && typeof call === 'object' && !Array.isArray(call)
  if (single && call.method === 'eth_getBlockByHash' && Array.isArray(call.params) && typeof call.params[0] === 'string' && call.params[1] === false) {
    const hit = headers.get(call.params[0].toLowerCase())
    if (hit !== undefined) {
      headerStats.hits++
      return { status: 200, text: `{"jsonrpc":"2.0","id":${JSON.stringify(call.id)},"result":${hit}}` }
    }
  }
  const out = await forward(body)
  if (single && call.method === 'eth_getLogs' && out.status === 200) {
    const reply = JSON.parse(out.text) // forward() only returns 200 for a body refusal() already parsed as JSON
    if (Array.isArray(reply.result) && reply.result.length > 0) {
      try {
        await prefetchHeaders(reply.result)
      } catch (e) {
        // The prefetch only saves time: without it nitro asks for each header itself, exactly as before, so the logs
        // are still handed over. Logged so a provider that stops answering batches shows up.
        log(`header prefetch failed: ${e.message}`)
      }
    }
  }
  return out
}

http
  .createServer(async (req, res) => {
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          current: host(UPSTREAMS[current]),
          stats: UPSTREAMS.map((u, i) => ({ upstream: host(u), ...stats[i] })),
          headerCache: { size: headers.size, ...headerStats },
        }),
      )
      return
    }
    const chunks = []
    for await (const c of req) chunks.push(c)
    const { status, text } = await handle(Buffer.concat(chunks), req.url === PLAIN_PATH)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(text)
  })
  .listen(PORT, () => log(`parent proxy on :${PORT}, primary ${host(UPSTREAMS[0])}, fallbacks ${UPSTREAMS.slice(1).map(host).join(', ')}`))
