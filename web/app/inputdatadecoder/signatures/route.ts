import type { NextRequest } from 'next/server'
import { functionSignatures, SELECTOR } from '@/lib/tools-api'

/** The Input Data Decoder's "without ABI" lookup: trusted signatures for one 4-byte selector, `{ signatures: [...] }`. */
export async function GET(req: NextRequest): Promise<Response> {
  const selector = req.nextUrl.searchParams.get('selector')
  if (selector === null || !SELECTOR.test(selector)) return Response.json({ error: 'selector: 0x and 8 lower-case hex characters' }, { status: 400 })
  return Response.json({ signatures: await functionSignatures(selector) })
}
