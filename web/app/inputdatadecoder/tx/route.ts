import type { NextRequest } from 'next/server'
import { NotFoundError } from '@/lib/api'
import { isTxHash } from '@/lib/format'
import { txCall } from '@/lib/tools-api'

/** The Input Data Decoder's "from Transaction": the transaction's input data, target and the target's verified ABI. */
export async function GET(req: NextRequest): Promise<Response> {
  const hash = req.nextUrl.searchParams.get('hash')
  if (hash === null || !isTxHash(hash)) return Response.json({ error: 'hash: 0x and 64 hex characters' }, { status: 400 })
  try {
    return Response.json(await txCall(hash))
  } catch (e) {
    // Blockscout answers 404 for a hash it has no transaction for; the form says so.
    if (e instanceof NotFoundError) return Response.json({ error: 'not found' }, { status: 404 })
    throw e
  }
}
