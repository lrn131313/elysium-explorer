import type { NextRequest } from 'next/server'
import { isAddress } from '@/lib/format'
import { verifiedAbi } from '@/lib/tools-api'

/** The Input Data Decoder's "from Address": the contract's verified ABI, `{ abi: [...] }`, or `{ abi: null }`. */
export async function GET(req: NextRequest): Promise<Response> {
  const a = req.nextUrl.searchParams.get('a')
  if (a === null || !isAddress(a)) return Response.json({ error: 'a: 0x and 40 hex characters' }, { status: 400 })
  return Response.json({ abi: await verifiedAbi(a) })
}
