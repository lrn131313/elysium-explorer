// Unit Converter arithmetic. Run: node --experimental-strip-types lib/tools-units.test.mjs
// Expected values come from Foundry's `cast to-unit` / `cast to-wei` (an independent implementation).
import assert from 'node:assert/strict'
import { amounts, convertAll, parseDecimal, shift } from './tools-units.ts'

let n = 0
const check = (name, fn) => {
  fn()
  n++
  console.log(`ok ${n} - ${name}`)
}

check('parses plain decimals only', () => {
  assert.deepEqual(parseDecimal('12.50'), { digits: 1250n, scale: 2 })
  assert.deepEqual(parseDecimal('.5'), { digits: 5n, scale: 1 })
  assert.deepEqual(parseDecimal('5.'), { digits: 5n, scale: 0 })
  for (const bad of ['', '.', '-1', '1e18', '1,000', '1.2.3', ' 1', '0x10', 'abc']) assert.equal(parseDecimal(bad), null, bad)
})

check('cast to-unit 1234567890123456789 gwei = 1234567890.123456789', () => {
  assert.equal(convertAll('wei', '1234567890123456789').gwei, '1234567890.123456789')
})

check('cast to-unit 1 ether (1 wei in HYPE) = 0.000000000000000001', () => {
  assert.equal(convertAll('wei', '1').hype, '0.000000000000000001')
})

check('cast to-wei 0.000000000000000001 ether = 1', () => {
  assert.equal(convertAll('hype', '0.000000000000000001').wei, '1')
})

check('cast to-unit 1 szabo = 0.000000000001', () => {
  assert.equal(convertAll('wei', '1').szabo, '0.000000000001')
})

check('cast to-wei 1.5 gwei = 1500000000', () => {
  assert.equal(convertAll('gwei', '1.5').wei, '1500000000')
})

check('cast to-unit 123456789012345678901234567890 ether = 123456789012.34567890123456789', () => {
  // cast keeps the trailing zero; the converter trims trailing fractional zeros.
  assert.equal(convertAll('wei', '123456789012345678901234567890').hype, '123456789012.34567890123456789')
})

check('one coin in every unit', () => {
  assert.deepEqual(amounts('hype', { digits: 1n, scale: 0 }), {
    wei: '1000000000000000000',
    kwei: '1000000000000000',
    mwei: '1000000000000',
    gwei: '1000000000',
    szabo: '1000000',
    finney: '1000',
    hype: '1',
  })
})

check('below one wei stays exact (no rounding)', () => {
  assert.equal(convertAll('wei', '0.5').hype, '0.0000000000000000005')
  assert.equal(convertAll('wei', '0.5').kwei, '0.0005')
})

check('the typed field keeps its text; zero converts to zero', () => {
  assert.equal(convertAll('gwei', '1.50').gwei, '1.50')
  assert.equal(convertAll('gwei', '1.50').wei, '1500000000')
  assert.equal(convertAll('finney', '0').wei, '0')
  assert.equal(convertAll('finney', '0.000').hype, '0')
})

check('shift moves the point both ways', () => {
  assert.equal(shift({ digits: 123n, scale: 0 }, -5), '0.00123')
  assert.equal(shift({ digits: 123n, scale: 2 }, 3), '1230')
  assert.equal(shift({ digits: 100n, scale: 0 }, -2), '1')
})

console.log(`# ${n} checks passed`)
