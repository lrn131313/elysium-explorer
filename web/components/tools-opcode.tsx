'use client'

import { useState } from 'react'
import { disassemble } from '@/lib/opcodes'
import { ToolCard } from './tools-layout'

type Result = { lines: string; count: number } | { error: string }

/** Pasted bytecode as bare hex: whitespace and line breaks dropped, one optional 0x; an error text when it is no bytecode. */
function readBytecode(text: string): { hex: string } | { error: string } {
  const compact = text.replace(/\s+/g, '')
  const hex = /^0x/i.test(compact) ? compact.slice(2) : compact
  if (hex === '') return { error: 'Enter the contract bytecode.' }
  if (!/^[0-9a-fA-F]+$/.test(hex)) return { error: 'The bytecode must be hexadecimal: the characters 0-9 and a-f, after an optional 0x.' }
  if (hex.length % 2 !== 0) return { error: 'The bytecode has an odd number of hex characters; every byte takes two.' }
  return { hex: hex.toLowerCase() }
}

/** Etherscan's Bytecode to Opcode Disassembler: one "[n] OPCODE 0x…" line per instruction, numbered from 1. */
export function OpcodeTool() {
  const [text, setText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const code = readBytecode(text)
          if ('error' in code) {
            setResult(code)
            return
          }
          const ins = disassemble(code.hex)
          const lines = ins.map((i, n) => `[${n + 1}] ${i.push === null ? i.name : `${i.name} ${i.push}`}`).join('\n')
          setResult({ lines, count: ins.length })
        }}
      >
        <ToolCard
          footer={
            <button type="submit" className="btn btn-primary tl-btn">
              Submit
            </button>
          }
        >
          <label className="form-label" htmlFor="opcode-bytecode">
            Enter Contract Bytecode
          </label>
          <textarea
            id="opcode-bytecode"
            name="bytecode"
            className="form-control"
            rows={10}
            placeholder="Enter Contract Bytecode (0x..)"
            autoComplete="off"
            spellCheck={false}
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </ToolCard>
      </form>
      {result !== null &&
        ('error' in result ? (
          <div className="alert alert-danger py-2 mt-3" role="alert">
            {result.error}
          </div>
        ) : (
          <ToolCard>
            <h3 className="tl-result-title">Decoded Bytecode :</h3>
            <p className="tl-tip mt-0 mb-2">
              {result.count.toLocaleString('en-US')} instruction{result.count === 1 ? '' : 's'}
            </p>
            <pre className="tl-output">{result.lines}</pre>
          </ToolCard>
        ))}
    </>
  )
}
