// What Broadcast Transaction accepts. Run: node --experimental-strip-types lib/tools-rawtx.test.mjs
import assert from 'node:assert/strict'
import { RAW_TX_MAX_BYTES, readRawTx } from './tools-rawtx.ts'

let n = 0
const check = (name, fn) => {
  fn()
  n++
  console.log(`ok ${n} - ${name}`)
}
const refused = (text, words) => {
  const r = readRawTx(text)
  assert.ok('error' in r, `accepted ${text.slice(0, 40)}`)
  assert.match(r.error, words)
}

check('normalises: optional 0x, upper case, pasted whitespace', () => {
  assert.deepEqual(readRawTx('0x02F8ab'), { hex: '0x02f8ab' })
  assert.deepEqual(readRawTx('02f8ab'), { hex: '0x02f8ab' })
  assert.deepEqual(readRawTx(' 0X02f8\n ab \t'), { hex: '0x02f8ab' })
})

check('accepts every transaction opening: typed 0x00-0x7f, legacy RLP list 0xc0-0xff', () => {
  for (const b of ['00', '01', '02', '03', '04', '7e', '7f', 'c0', 'f8', 'f9', 'ff']) assert.ok('hex' in readRawTx(`0x${b}aa`), b)
})

check('refuses an RLP string opening (0x80-0xbf): no transaction starts that way', () => {
  for (const b of ['80', '94', 'b8', 'bf']) refused(`0x${b}aa`, /not a signed transaction/)
})

check('refuses empty, non-hex and odd-length input', () => {
  refused('', /Enter the signed/)
  refused('0x', /Enter the signed/)
  refused('  \n', /Enter the signed/)
  refused('0x02zz', /hexadecimal/)
  refused('0x0x02', /hexadecimal/)
  refused('0x02,f8', /hexadecimal/)
  refused('0x02f', /odd number/)
})

check(`caps the size at ${RAW_TX_MAX_BYTES} bytes`, () => {
  assert.ok('hex' in readRawTx(`0x02${'ab'.repeat(RAW_TX_MAX_BYTES - 1)}`))
  refused(`0x02${'ab'.repeat(RAW_TX_MAX_BYTES)}`, /at most 131072/)
})
