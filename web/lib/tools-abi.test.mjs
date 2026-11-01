// The ABI decoder against encodings made by an independent implementation, Foundry's `cast` (1.8.1):
// `cast keccak`, `cast to-check-sum-address`, `cast sig` and `cast calldata` (commands quoted beside each vector).
// Run: node --experimental-strip-types lib/tools-abi.test.mjs
import assert from 'node:assert/strict'
import {
  AbiError,
  canonical,
  decodeCall,
  describeCall,
  findFunction,
  formatValue,
  hexToBytes,
  keccak256,
  parseAbiJson,
  parseSignature,
  selectorOf,
  toChecksumAddress,
  toHex,
} from './tools-abi.ts'

let n = 0
const check = (name, fn) => {
  fn()
  n++
  console.log(`ok ${n} - ${name}`)
}
const utf8 = (s) => new TextEncoder().encode(s)
const bytes = (hex) => hexToBytes(hex, 'input data')
const decodeSig = (sig, hex) => decodeCall(parseSignature(sig), bytes(hex))
const shown = (call) => call.params.map((p) => formatValue(p.value))
const refuses = (fn, pattern) => assert.throws(fn, (e) => e instanceof AbiError && pattern.test(e.message))

check('keccak256: cast keccak of "", of a signature, and at the padding edges (135, 136, 300 bytes)', () => {
  assert.equal(toHex(keccak256(new Uint8Array(0))), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
  assert.equal(toHex(keccak256(utf8('transfer(address,uint256)'))), 'a9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b')
  assert.equal(toHex(keccak256(utf8('a'.repeat(135)))), '34367dc248bbd832f4e3e69dfaac2f92638bd0bbd18f2912ba4ef454919cf446')
  assert.equal(toHex(keccak256(utf8('b'.repeat(136)))), '121b76d0b19f3c2c7632310b92c54cddd59d16a6b5aafe84696426f10e5733bf')
  const abc300 = Array.from({ length: 300 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('')
  assert.equal(toHex(keccak256(utf8(abc300))), '5208eae4d1b18a827690de04c51656186bde5137d13950f9069add8853c0c6af')
})

check('EIP-55: cast to-check-sum-address', () => {
  assert.equal(toChecksumAddress('d8da6bf26964af9d7eed9e03e53415d37aa96045'), '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')
  assert.equal(toChecksumAddress('02a236e362d3cdd708b063a66dda8b47cfd95555'), '0x02a236E362D3cDD708B063a66dda8b47Cfd95555')
  assert.equal(toChecksumAddress('DD69D868E4ABDD7089BFFB83FED446C99C71D6C8'), '0xdD69d868e4ABDd7089bfFB83fED446c99c71D6C8')
})

check('selectors: cast sig, tuples written with and without "tuple"', () => {
  assert.equal(selectorOf(parseSignature('transfer(address,uint256)')), '0xa9059cbb')
  assert.equal(selectorOf(parseSignature('f((address,uint256)[],bytes)')), '0xd397742b')
  assert.equal(selectorOf(parseSignature('f(tuple(address,uint256)[],bytes)')), '0xd397742b')
  assert.equal(selectorOf(parseSignature('swap((address,uint24,int24)[],address)')), '0xffaafcd8')
  assert.equal(selectorOf(parseSignature('totalSupply()')), '0x18160ddd')
  // uint and int are aliases of uint256 and int256.
  assert.equal(selectorOf(parseSignature('transfer(address,uint)')), '0xa9059cbb')
})

check('transfer: cast calldata "transfer(address,uint256)" 0xd8da…6045 1000000000000000000', () => {
  const c = decodeSig('transfer(address,uint256)', '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000')
  assert.equal(c.selector, '0xa9059cbb')
  assert.deepEqual(shown(c), ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', '1000000000000000000'])
})

check('every kind of type: cast calldata "f(uint8,int16,bool,bytes3,bytes,string,uint256[],address[2],(uint256,string)[],(bool,bytes32[2]))"', () => {
  const c = decodeSig('f(uint8,int16,bool,bytes3,bytes,string,uint256[],address[2],(uint256,string)[],(bool,bytes32[2]))', '0x6e96781700000000000000000000000000000000000000000000000000000000000000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed40000000000000000000000000000000000000000000000000000000000000001abcdef000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000220000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045000000000000000000000000dd69d868e4abdd7089bffb83fed446c99c71d6c800000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000000011111111111111111111111111111111111111111111111111111111111111111222222222222222222222222222222222222222222222222222222222222222200000000000000000000000000000000000000000000000000000000000000050102030405000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d68c3a96c6c6f2077c3b6726c640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000161000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000026262000000000000000000000000000000000000000000000000000000000000')
  assert.equal(c.selector, '0x6e967817')
  assert.deepEqual(shown(c), [
    '255',
    '-300',
    'true',
    '0xabcdef',
    '0x0102030405',
    'héllo wörld',
    '[1, 2, 3]',
    '[0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045, 0xdD69d868e4ABDd7089bfFB83fED446c99c71D6C8]',
    '[(7, "a"), (8, "bb")]',
    '(true, [0x1111111111111111111111111111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222222222222222222222222222])',
  ])
  assert.deepEqual(
    c.params.map((p) => canonical(p.type)),
    ['uint8', 'int16', 'bool', 'bytes3', 'bytes', 'string', 'uint256[]', 'address[2]', '(uint256,string)[]', '(bool,bytes32[2])'],
  )
})

check('integer edges: cast calldata "g(int256,int8,int8,uint256)" -1 -128 127 2^256-1', () => {
  const c = decodeSig('g(int256,int8,int8,uint256)', '0x10630088ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff80000000000000000000000000000000000000000000000000000000000000007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  assert.deepEqual(shown(c), ['-1', '-128', '127', '115792089237316195423570985008687907853269984665640564039457584007913129639935'])
})

check('nested dynamic arrays: cast calldata "h(uint256[][],string[],bytes[2])" [[1,2],[],[3]] ["x","yy",""] [0x,0xff]', () => {
  const c = decodeSig('h(uint256[][],string[],bytes[2])', '0x04b83017000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002c00000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000178000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002797900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001ff00000000000000000000000000000000000000000000000000000000000000')
  assert.deepEqual(shown(c), ['[[1, 2], [], [3]]', '["x", "yy", ""]', '[0x, 0xff]'])
})

check('JSON ABI with named tuple components picks the function by selector', () => {
  const abi = JSON.stringify([
    { type: 'event', name: 'Swap', inputs: [], anonymous: false },
    { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
    {
      type: 'function',
      name: 'swap',
      stateMutability: 'nonpayable',
      inputs: [
        {
          name: 'hops',
          type: 'tuple[]',
          components: [
            { name: 'token', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tick', type: 'int24' },
          ],
        },
        { name: 'recipient', type: 'address' },
      ],
    },
  ])
  const input = bytes('0xffaafcd80000000000000000000000000000000000000000000000000000000000000040000000000000000000000000dd69d868e4abdd7089bffb83fed446c99c71d6c8000000000000000000000000000000000000000000000000000000000000000100000000000000000000000002a236e362d3cdd708b063a66dda8b47cfd955550000000000000000000000000000000000000000000000000000000000000bb8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc4')
  const c = decodeCall(findFunction(parseAbiJson(abi), input), input)
  assert.equal(c.signature, 'swap((address,uint24,int24)[],address)')
  assert.equal(describeCall(c), 'swap((address,uint24,int24)[] hops, address recipient)')
  assert.deepEqual(shown(c), ['[(0x02a236E362D3cDD708B063a66dda8b47Cfd95555, 3000, -60)]', '0xdD69d868e4ABDd7089bfFB83fED446c99c71D6C8'])
  // A compiler artifact ({"abi": [...]}) and a single function entry read the same.
  assert.equal(findFunction(parseAbiJson(JSON.stringify({ abi: JSON.parse(abi) })), input).name, 'swap')
  assert.equal(findFunction(parseAbiJson(JSON.stringify(JSON.parse(abi)[2])), input).name, 'swap')
})

check('hex input: whitespace and 0x are optional; bad hex is refused', () => {
  assert.deepEqual(shown(decodeSig('transfer(address,uint256)', '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000'.slice(2).replace(/(.{64})/g, '$1\n'))), shown(decodeSig('transfer(address,uint256)', '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000')))
  refuses(() => bytes('0xzz'), /hexadecimal/)
  refuses(() => bytes('0xabc'), /odd number/)
})

// Strictness: data a contract would reject does not decode, so a wrong guess at the function does not pass.
const C1 = '0xa9059cbb000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa960450000000000000000000000000000000000000000000000000de0b6b3a7640000'
const word = (i) => 10 + i * 64 // hex index of argument word i (after 0x and the selector)
const patch = (hex, at, text) => hex.slice(0, at) + text + hex.slice(at + text.length)

check('strict: address padding, bool range, uint range, bytesN padding', () => {
  refuses(() => decodeSig('transfer(address,uint256)', patch(C1, word(0), '01')), /not an address/)
  refuses(() => decodeSig('transfer(bool,uint256)', C1.replace('a9059cbb', toHex(keccak256(utf8('transfer(bool,uint256)'))).slice(0, 8))), /not a bool/)
  const sel = (sig) => '0x' + toHex(keccak256(utf8(sig))).slice(0, 8)
  refuses(() => decodeSig('t(uint8)', sel('t(uint8)') + '00'.repeat(30) + '0100'), /does not fit in uint8/)
  refuses(() => decodeSig('t(int8)', sel('t(int8)') + '00'.repeat(31) + '80'), /does not fit in int8/)
  refuses(() => decodeSig('t(bytes2)', sel('t(bytes2)') + 'abcd01' + '00'.repeat(29)), /not a bytes2/)
})

check('strict: truncated data, offsets and lengths past the end, wrong selector', () => {
  refuses(() => decodeSig('transfer(address,uint256)', C1.slice(0, -2)), /ends too early/)
  const sel = '0x' + toHex(keccak256(utf8('t(bytes)'))).slice(0, 8)
  refuses(() => decodeSig('t(bytes)', sel + (0x1000).toString(16).padStart(64, '0')), /offset/)
  refuses(() => decodeSig('t(bytes)', sel + (32).toString(16).padStart(64, '0') + (64).toString(16).padStart(64, '0') + 'ab'.repeat(32)), /runs past the end/)
  const arr = '0x' + toHex(keccak256(utf8('t(uint256[])'))).slice(0, 8)
  refuses(() => decodeSig('t(uint256[])', arr + (32).toString(16).padStart(64, '0') + 'ff'.repeat(32)), /larger than the data/)
  refuses(() => decodeSig('approve(address,uint256)', C1), /selector 0xa9059cbb is not approve/)
  refuses(() => findFunction(parseAbiJson('[{"type":"function","name":"approve","inputs":[{"type":"address"},{"type":"uint256"}]}]'), bytes(C1)), /No function in this ABI has the selector 0xa9059cbb/)
})

check('bad ABIs and signatures are explained', () => {
  refuses(() => parseAbiJson('[{'), /not valid JSON/)
  refuses(() => parseAbiJson('[]'), /no entries/)
  refuses(() => parseAbiJson('[{"type":"event","name":"E","inputs":[]}]'), /no functions/)
  refuses(() => parseAbiJson('[{"type":"function","name":"f","inputs":[{"name":"x","type":"tuple"}]}]'), /no "components"/)
  refuses(() => parseSignature('f(uint7)'), /uint7/)
  refuses(() => parseSignature('f(bytes33)'), /bytes33/)
  refuses(() => parseSignature('f((uint256,address)'), /Not a function signature|Unbalanced/)
  refuses(() => parseSignature('f(fixed128x18)'), /not supported/)
})

console.log(`# ${n} checks passed`)
