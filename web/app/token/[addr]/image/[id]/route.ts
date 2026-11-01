// One NFT's picture, for <img src> in the NFT lists and the Inventory tab. Blockscout returns most of this chain's NFT
// images as on-chain `data:` URIs of several KB, three times per item; putting them in the pages would make every list
// heavy, so the pages point here instead. What is served, and with which headers, is decided in lib/token-image.ts.
import { NotFoundError } from '@/lib/api'
import { isAddress } from '@/lib/format'
import { tokenApi } from '@/lib/token-api'
import { imageResponse, placeholderResponse } from '@/lib/token-image'

export async function GET(_req: Request, { params }: { params: Promise<{ addr: string; id: string }> }) {
  const { addr, id } = await params
  if (!isAddress(addr) || !/^\d{1,78}$/.test(id)) return new Response('Not found', { status: 404 })
  let image: string | null
  try {
    image = (await tokenApi.instance(addr, id)).image_url
  } catch (e) {
    // Blockscout answers 404 for a token id it has no record of; that item simply has no picture to show.
    if (e instanceof NotFoundError) return placeholderResponse()
    throw e
  }
  return imageResponse(image)
}
