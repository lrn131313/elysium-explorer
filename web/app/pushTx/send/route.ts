import { rpcBatch } from '@/lib/api'
import { RAW_TX_MAX_BYTES, readRawTx } from '@/lib/tools-rawtx'

/** The request body may hold the largest accepted transaction as hex inside a small JSON object, and no more. */
const BODY_LIMIT = 2 * RAW_TX_MAX_BYTES + 1_024

/** The body as text, read no further than `limit` bytes; null when it is longer. */
async function readCapped(req: Request, limit: number): Promise<string | null> {
  const declared = req.headers.get('content-length')
  if (declared !== null && Number(declared) > limit) return null
  if (req.body === null) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    all.set(c, at)
    at += c.length
  }
  return new TextDecoder().decode(all)
}

const refuse = (status: number, error: string) => Response.json({ error, from: 'explorer' }, { status, headers: { 'cache-control': 'no-store' } })

/**
 * Broadcast Transaction: `{ "hex": "0x…" }` → eth_sendRawTransaction on our node, which forwards it to the sequencer.
 * Answers `{ hash }`, or `{ error, from: "node" }` with the node's own words, or `{ error, from: "explorer" }` when the
 * request never reached the node. POST only, JSON only (a plain cross-site form cannot send it), one method only.
 */
export async function POST(req: Request): Promise<Response> {
  const type = req.headers.get('content-type')
  if (type === null || !type.toLowerCase().startsWith('application/json')) return refuse(415, 'Send the transaction as JSON: {"hex": "0x…"}.')
  const body = await readCapped(req, BODY_LIMIT)
  if (body === null) return refuse(413, `The request is larger than a transaction can be (${RAW_TX_MAX_BYTES} bytes).`)
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (e) {
    // JSON.parse reports bad input only as a SyntaxError; that is the sender's mistake, answered as such.
    if (e instanceof SyntaxError) return refuse(400, 'The request is not valid JSON.')
    throw e
  }
  if (typeof parsed !== 'object' || parsed === null || !('hex' in parsed) || typeof parsed.hex !== 'string') return refuse(400, 'The request needs a "hex" string.')
  const tx = readRawTx(parsed.hex)
  if ('error' in tx) return refuse(400, tx.error)

  const [reply] = await rpcBatch([{ method: 'eth_sendRawTransaction', params: [tx.hex] }], 30_000)
  if (reply === undefined) throw new Error('node RPC eth_sendRawTransaction: empty batch reply')
  if ('error' in reply) return Response.json({ error: reply.error, from: 'node' }, { status: 422, headers: { 'cache-control': 'no-store' } })
  if (typeof reply.result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(reply.result)) throw new Error(`node RPC eth_sendRawTransaction: unexpected result ${JSON.stringify(reply.result)}`)
  return Response.json({ hash: reply.result }, { headers: { 'cache-control': 'no-store' } })
}
