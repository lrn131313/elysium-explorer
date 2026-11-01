'use client'

import { useState } from 'react'
import { amounts, convertAll, UNITS, type UnitKey } from '@/lib/tools-units'

/** Etherscan opens the converter on one coin (Wei 1000000000000000000). */
const ONE_COIN = amounts('hype', { digits: 1n, scale: 0 })

/** Etherscan's unit converter: typing in any field rewrites all the others, exactly. */
export function UnitConverter() {
  const [values, setValues] = useState<Record<UnitKey, string>>(ONE_COIN)
  const [invalid, setInvalid] = useState<UnitKey | null>(null)

  const change = (key: UnitKey, text: string) => {
    const t = text.trim()
    if (t === '') {
      setValues(Object.fromEntries(UNITS.map((u) => [u.key, ''])) as Record<UnitKey, string>)
      setInvalid(null)
      return
    }
    const all = convertAll(key, t)
    if (all === null) {
      // Keep what was typed so it can be corrected; the other fields still show the last amount that parsed.
      setValues((v) => ({ ...v, [key]: text }))
      setInvalid(key)
      return
    }
    setValues(all)
    setInvalid(null)
  }

  return (
    <div className="row">
      <div className="col-xl-6">
        <label className="form-label" htmlFor="unit-wei">
          Enter any value
        </label>
        {UNITS.map((u, i) => (
          <div key={u.key} className={`input-group ${i === UNITS.length - 1 ? 'mb-3' : 'mb-2'}`}>
            <input
              id={`unit-${u.key}`}
              className={`form-control${invalid === u.key ? ' is-invalid' : ''}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder={u.label}
              aria-label={u.label}
              aria-invalid={invalid === u.key}
              value={values[u.key]}
              onChange={(e) => change(u.key, e.target.value)}
            />
            <span className="input-group-text tl-unit">
              {u.exp === 18 ? (
                `${u.label} (1)`
              ) : (
                <>
                  {u.label} (10<sup>{u.exp - 18}</sup>)
                </>
              )}
            </span>
          </div>
        ))}
        {invalid !== null && (
          <p className="tl-tip text-danger mb-0" role="alert">
            Enter a plain number, such as 1 or 0.5, without commas or signs.
          </p>
        )}
      </div>
    </div>
  )
}
