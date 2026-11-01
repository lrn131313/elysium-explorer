// A token's icon, for the token page header. The page links here only when Blockscout's `icon_url` is an on-chain
// `data:` image (see isServableImage); an off-chain URL is never loaded by a visitor's browser. What is served, and with
// which headers, is decided in lib/token-image.ts.
import { api, NotFoundError } from '@/lib/api'
import { isAddress } from '@/lib/format'
import { imageResponse, placeholderResponse } from '@/lib/token-image'

export async function GET(_req: Request, { params }: { params: Promise<{ addr: string }> }) {
  const { addr } = await params
  if (!isAddress(addr)) return new Response('Not found', { status: 404 })
  let icon: string | null
  try {
    icon = (await api.token(addr)).icon_url
  } catch (e) {
    // Blockscout answers 404 for an address that is not a token; it has no icon to show.
    if (e instanceof NotFoundError) return placeholderResponse()
    throw e
  }
  return imageResponse(icon)
}
