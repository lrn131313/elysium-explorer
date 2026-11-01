'use client'

import { Box, Braces, Check, ChevronRight, Code2, Copy as CopyIcon, Expand, Link2, Maximize, Settings } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { opcodeText } from '@/lib/opcodes'

function useCopy(): [boolean, (text: string) => void] {
  const [done, setDone] = useState(false)
  return [
    done,
    (text: string) => {
      void navigator.clipboard.writeText(text).then(() => {
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      })
    },
  ]
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="ex-iconbtn ex-iconbtn-sm" title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Etherscan's code panes (Contract ABI, Deployed Bytecode, …): a heading, copy and expand buttons on the right,
 * and a fixed-height box the reader can drag taller.
 */
export function CodeBox({
  title,
  icon,
  text,
  extra,
  copy = true,
}: {
  title: React.ReactNode
  icon: React.ReactNode
  text: string
  extra?: React.ReactNode
  copy?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [copied, doCopy] = useCopy()
  return (
    <section className="ex-codebox">
      <div className="ex-codebox-head">
        <h3 className="ex-codebox-title">
          {icon}
          {title}
        </h3>
        <div className="d-flex align-items-center gap-2">
          {extra}
          {copy && (
            <IconButton label={copied ? 'Copied' : 'Copy to clipboard'} onClick={() => doCopy(text)}>
              {copied ? <Check size={14} /> : <CopyIcon size={14} />}
            </IconButton>
          )}
          <IconButton label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => !o)}>
            <Expand size={14} />
          </IconButton>
        </div>
      </div>
      <pre className={`ex-pre${open ? ' ex-pre-open' : ''}`}>{text}</pre>
    </section>
  )
}

/** Deployed bytecode with Etherscan's "Switch to Opcodes View" toggle. */
export function BytecodeBox({ title, bytecode }: { title: string; bytecode: string }) {
  const [ops, setOps] = useState(false)
  const text = useMemo(() => (ops ? opcodeText(bytecode) : bytecode), [ops, bytecode])
  return (
    <CodeBox
      title={title}
      icon={<Code2 size={16} />}
      text={text}
      extra={
        <button type="button" className="btn btn-sm btn-white" onClick={() => setOps((o) => !o)}>
          {ops ? 'Switch Back To Bytecode View' : 'Switch to Opcodes View'}
        </button>
      }
    />
  )
}

// ---------- multi-file source viewer ----------

export interface SourceFile {
  path: string
  code: string
  settings?: boolean // the compiler settings shown as settings.json
}

type Seg = { cls: string | null; text: string }

const KEYWORDS = new Set(
  (
    'pragma solidity import from as contract interface library abstract is function modifier event error struct enum ' +
    'mapping returns return if else for while do break continue new delete emit try catch revert require assert public ' +
    'private internal external pure view payable constant immutable override virtual memory storage calldata using ' +
    'constructor fallback receive unchecked assembly let true false this super type indexed anonymous transient'
  ).split(' '),
)
const TYPE = /^(u?int\d*|bytes\d*|address|bool|string|byte|u?fixed[\dx]*)$/

/** Small Solidity tokenizer for colouring: comments, strings, numbers, keywords and elementary types. */
function tokenize(src: string): Seg[] {
  const out: Seg[] = []
  let i = 0
  let plain = ''
  const flush = () => {
    if (plain) out.push({ cls: null, text: plain })
    plain = ''
  }
  while (i < src.length) {
    const c = src.charAt(i)
    const rest = src.slice(i, i + 2)
    if (rest === '//' || rest === '/*') {
      const end = rest === '//' ? src.indexOf('\n', i) : src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : rest === '//' ? end : end + 2
      flush()
      out.push({ cls: 'tk-c', text: src.slice(i, stop) })
      i = stop
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < src.length && src.charAt(j) !== c && src.charAt(j) !== '\n') j += src.charAt(j) === '\\' ? 2 : 1
      flush()
      out.push({ cls: 'tk-s', text: src.slice(i, j + 1) })
      i = j + 1
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 80))
      const w = m ? m[0] : c
      if (KEYWORDS.has(w) || TYPE.test(w)) {
        flush()
        out.push({ cls: 'tk-k', text: w })
      } else plain += w
      i += w.length
      continue
    }
    if (/\d/.test(c) && !/[\w$]/.test(src.charAt(i - 1))) {
      const m = /^(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d+)?([eE]\d+)?)/.exec(src.slice(i, i + 100))
      const n = m ? m[0] : c
      flush()
      out.push({ cls: 'tk-n', text: n })
      i += n.length
      continue
    }
    plain += c
    i++
  }
  flush()
  return out
}

/** Tokens split into lines, so each line can sit next to its number. */
function lines(src: string): Seg[][] {
  let cur: Seg[] = []
  const rows: Seg[][] = [cur]
  for (const seg of tokenize(src)) {
    seg.text.split('\n').forEach((p, k) => {
      if (k > 0) {
        cur = []
        rows.push(cur)
      }
      if (p) cur.push({ cls: seg.cls, text: p })
    })
  }
  return rows
}

const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1)

/** Contracts/interfaces/libraries and functions declared in a file, with their line numbers (the OUTLINE panel). */
function outline(src: string): { contracts: [string, number][]; functions: [string, number][] } {
  const contracts: [string, number][] = []
  const functions: [string, number][] = []
  src.split('\n').forEach((line, n) => {
    const code = line.replace(/\/\/.*$/, '')
    const c = /^\s*(?:abstract\s+)?(?:contract|interface|library)\s+(\w+)/.exec(code)
    if (c?.[1]) contracts.push([c[1], n + 1])
    const f = /\bfunction\s+(\w+)/.exec(code)
    if (f?.[1]) functions.push([f[1], n + 1])
  })
  return { contracts, functions }
}

/** "contracts/src/v2/Token.sol" reads "contracts/.../Token.sol" in the file list, as on Etherscan. */
function shortPath(p: string): string {
  const segments = p.split('/').length
  return segments > 2 ? `${p.slice(0, p.indexOf('/'))}/.../${baseName(p)}` : p
}

export function SourceViewer({ files, initial = 0 }: { files: SourceFile[]; initial?: number }) {
  const [idx, setIdx] = useState(initial >= 0 && initial < files.length ? initial : 0)
  const [copied, doCopy] = useCopy()
  const [linked, doLink] = useCopy()
  const box = useRef<HTMLDivElement>(null)
  const code = useRef<HTMLDivElement>(null)
  const file = files[idx]
  const rows = useMemo(() => (file ? lines(file.code) : []), [file])
  const out = useMemo(() => (file && !file.settings ? outline(file.code) : { contracts: [], functions: [] }), [file])
  if (!file) return null // no files at all: the server only renders the viewer for verified sources, so this is an empty list
  const name = baseName(file.path)

  const goto = (line: number) => {
    const el = code.current?.querySelector<HTMLElement>(`[data-line="${line}"]`)
    if (el && code.current) code.current.scrollTop = el.offsetTop - 8
  }

  return (
    <div className="ex-ide" ref={box}>
      <div className="ex-ide-side">
        <div className="ex-ide-head">Explorer</div>
        <div className="ex-ide-files">
          {files.map((f, k) => (
            <button
              key={f.path}
              type="button"
              className={`ex-ide-file${k === idx ? ' active' : ''}`}
              title={f.path}
              onClick={() => {
                setIdx(k)
                if (code.current) code.current.scrollTop = 0
              }}
            >
              {f.settings ? <Braces size={13} className="ex-ide-json" /> : <Code2 size={13} className="ex-ide-sol" />}
              <span className="text-truncate">{f.settings ? f.path : shortPath(f.path)}</span>
            </button>
          ))}
        </div>
        {(out.contracts.length > 0 || out.functions.length > 0) && (
          <div className="ex-ide-outline">
            <div className="ex-ide-head">Outline</div>
            {out.contracts.length > 0 && <div className="ex-ide-group">Contract</div>}
            {out.contracts.map(([n, l]) => (
              <button key={`c${l}`} type="button" className="ex-ide-item" onClick={() => goto(l)}>
                <Box size={12} className="ex-ide-contract" /> {n}
              </button>
            ))}
            {out.functions.length > 0 && <div className="ex-ide-group">Function</div>}
            {out.functions.map(([n, l]) => (
              <button key={`f${l}`} type="button" className="ex-ide-item" onClick={() => goto(l)}>
                <Settings size={12} className="ex-ide-fn" /> {n}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ex-ide-main">
        <div className="ex-ide-tabs">
          <span className="ex-ide-tab">
            {file.settings ? <Braces size={13} className="ex-ide-json" /> : <Code2 size={13} className="ex-ide-sol" />}
            {name}
          </span>
          <span className="ms-auto d-flex align-items-center gap-1 pe-2">
            <IconButton label={copied ? 'Copied' : 'Copy source code to clipboard'} onClick={() => doCopy(file.code)}>
              {copied ? <Check size={14} /> : <CopyIcon size={14} />}
            </IconButton>
            <IconButton
              label={linked ? 'Copied' : 'Copy a link to this file'}
              onClick={() => {
                const u = new URL(window.location.href)
                u.searchParams.set('tab', 'contract')
                u.searchParams.set('file', String(idx))
                u.hash = ''
                doLink(u.toString())
              }}
            >
              {linked ? <Check size={14} /> : <Link2 size={14} />}
            </IconButton>
            <IconButton
              label="Toggle fullscreen"
              onClick={() => {
                if (document.fullscreenElement) void document.exitFullscreen()
                else void box.current?.requestFullscreen()
              }}
            >
              <Maximize size={14} />
            </IconButton>
          </span>
        </div>
        <div className="ex-ide-crumbs">
          {file.path.split('/').map((p, k, all) => (
            <span key={`${p}-${k}`}>
              {p}
              {k < all.length - 1 && <ChevronRight size={11} className="mx-1" />}
            </span>
          ))}
        </div>
        <div className="ex-ide-code" ref={code}>
          {rows.map((segs, n) => (
            <div className="ex-ide-line" key={n} data-line={n + 1}>
              <span className="ex-ide-ln">{n + 1}</span>
              <span className="ex-ide-src">
                {segs.map((s, k) =>
                  s.cls ? (
                    <span key={k} className={s.cls}>
                      {s.text}
                    </span>
                  ) : (
                    s.text
                  ),
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
