// Token pictures (NFT images, token icons) served from our own origin (server only). Blockscout hands back whatever
// the token's metadata names: an on-chain `data:` image or an off-chain URL. Only `data:` images in common raster/SVG
// formats are ever shown; anything else gets our neutral placeholder or none at all, so no visitor's browser is sent
// to a third-party host. The bytes come from token creators: the sandbox CSP and nosniff keep a crafted SVG inert
// even when it is opened directly.

const TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])
const MAX_BYTES = 2_000_000

// Translucent grey on purpose: an <img> cannot read the page's theme variables, and this reads on light, dim and dark.
const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="8" fill="#adb5bd" fill-opacity="0.15"/><g transform="translate(20 20)" fill="none" stroke="#adb5bd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></g></svg>`

const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
}

export interface DataImage {
  type: string
  bytes: Uint8Array<ArrayBuffer>
}

/** The bytes and type of a `data:` image URI (base64 or percent-encoded); null for anything else, URLs included. */
export function decodeDataImage(uri: string): DataImage | null {
  if (!uri.startsWith('data:')) return null
  const comma = uri.indexOf(',')
  if (comma < 0) return null
  // "data:<type>[;param=value]*[;base64],<body>"
  const head = uri.slice('data:'.length, comma).toLowerCase()
  const semi = head.indexOf(';')
  const type = (semi < 0 ? head : head.slice(0, semi)).trim()
  if (!TYPES.has(type)) return null
  const body = uri.slice(comma + 1)
  const bytes = head.split(';').includes('base64') ? Buffer.from(body, 'base64') : percentDecoded(body)
  if (bytes === null || bytes.length === 0 || bytes.length > MAX_BYTES) return null
  return { type, bytes: new Uint8Array(bytes) }
}

/** A percent-encoded data URI body as bytes; null when its escapes are malformed (the creator's URI is broken). */
function percentDecoded(body: string): Buffer | null {
  try {
    return Buffer.from(decodeURIComponent(body), 'utf8')
  } catch (e) {
    // decodeURIComponent throws URIError on a stray "%" or a bad UTF-8 sequence: that image cannot be shown.
    if (e instanceof URIError) return null
    throw e
  }
}

/** Whether a page may point an <img> at our route for this URI: only when the route would serve the image itself. */
export const isServableImage = (uri: string | null): uri is string => uri !== null && decodeDataImage(uri) !== null

export function placeholderResponse(): Response {
  return new Response(PLACEHOLDER, { headers: { ...HEADERS, 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=600' } })
}

/** The response for an image URI from Blockscout: the decoded `data:` image, or the placeholder for anything else. */
export function imageResponse(uri: string | null): Response {
  const decoded = uri === null ? null : decodeDataImage(uri)
  if (decoded === null) return placeholderResponse()
  return new Response(decoded.bytes, { headers: { ...HEADERS, 'Content-Type': decoded.type, 'Cache-Control': 'public, max-age=3600' } })
}
