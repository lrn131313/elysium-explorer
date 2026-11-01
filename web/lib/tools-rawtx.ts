// What Broadcast Transaction (/pushTx) accepts as a signed raw transaction. Pure, so the form checks the same rules in
// the browser that the server route enforces before anything reaches the node.

/** geth's own ceiling for one transaction (txMaxSize, 4 × 32 KiB); the node refuses anything larger anyway. */
export const RAW_TX_MAX_BYTES = 131_072

/**
 * A pasted signed transaction as "0x" + lower-case hex, or why it cannot be one. Whitespace (pasted line breaks) is
 * dropped and the 0x is optional. The first byte must open a transaction: an EIP-2718 type (0x00–0x7f) or, for a
 * legacy transaction, an RLP list (0xc0–0xff); 0x80–0xbf would be an RLP string, never a transaction.
 */
export function readRawTx(text: string): { hex: string } | { error: string } {
  const compact = text.replace(/\s+/g, '')
  const hex = /^0x/i.test(compact) ? compact.slice(2) : compact
  if (hex === '') return { error: 'Enter the signed transaction hex.' }
  if (!/^[0-9a-fA-F]+$/.test(hex)) return { error: 'The transaction must be hexadecimal: the characters 0-9 and a-f, after an optional 0x.' }
  if (hex.length % 2 !== 0) return { error: 'The transaction has an odd number of hex characters; every byte takes two.' }
  if (hex.length / 2 > RAW_TX_MAX_BYTES) return { error: `The transaction is ${hex.length / 2} bytes; the node accepts at most ${RAW_TX_MAX_BYTES}.` }
  const first = Number.parseInt(hex.slice(0, 2), 16)
  if (first >= 0x80 && first < 0xc0) return { error: `This is not a signed transaction: it starts with byte 0x${hex.slice(0, 2)}, which no transaction starts with.` }
  return { hex: `0x${hex.toLowerCase()}` }
}
