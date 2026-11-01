'use client'

import { useState } from 'react'
import { LOOKALIKE_CHARS } from '@/lib/chrome-lookalike'
import { setPrefs, type Prefs } from '@/lib/chrome-prefs'
import { SITE } from '@/lib/site'
import { usePrefs } from './chrome-prefs'

type SelectKey = 'theme' | 'age' | 'amount' | 'fee'

/** A row's texts and options; K ties the option values to the preference they set. */
interface SelectRow<K extends SelectKey> {
  title: string
  text: string
  note?: string
  options: { value: Prefs[K]; label: string }[]
}

const LISTS_NOTE = '*Note: Applies to the transaction and transfer lists'

const THEME: SelectRow<'theme'> = {
  title: 'Theme',
  text: 'Choose the colour theme of the site',
  note: '*Note: Auto (System) follows your device: Dim when it is set to dark, Light otherwise',
  options: [
    { value: 'light', label: 'Light' },
    { value: 'dim', label: 'Dim' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Auto (System)' },
  ],
}

const AGE: SelectRow<'age'> = {
  title: 'Age Column',
  text: 'Show when a transaction happened as its age or as its date and time',
  note: LISTS_NOTE,
  options: [
    { value: 'age', label: 'Age (e.g. 5 mins ago)' },
    { value: 'datetime', label: 'Date Time (UTC)' },
  ],
}

const AMOUNT: SelectRow<'amount'> = {
  title: 'Amount Column',
  text: `Show amounts in ${SITE.coin} or as their value in US dollars`,
  note: LISTS_NOTE,
  options: [
    { value: 'amount', label: `Amount (${SITE.coin})` },
    { value: 'usd', label: 'Value (USD)' },
  ],
}

const FEE: SelectRow<'fee'> = {
  title: 'Txn Fee Column',
  text: 'Show the fee a transaction paid or the gas price it paid',
  note: LISTS_NOTE,
  options: [
    { value: 'fee', label: 'Txn Fee' },
    { value: 'gasprice', label: 'Gas Price' },
  ],
}

/** One settings row with a select; picking an option only changes the draft. */
function SelectSetting<K extends SelectKey>({ row, value, onPick }: { row: SelectRow<K>; value: Prefs[K]; onPick: (v: Prefs[K]) => void }) {
  return (
    <>
      <div className="ex-settings-row">
        <div>
          <h3>{row.title}</h3>
          <p>{row.text}</p>
          {row.note !== undefined && <p className="small text-muted">{row.note}</p>}
        </div>
        <div>
          <select
            className="form-select"
            aria-label={row.title}
            value={value}
            onChange={(e) => {
              const hit = row.options.find((o) => o.value === e.target.value)
              if (hit) onPick(hit.value)
            }}
          >
            {row.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <hr />
    </>
  )
}

/** One settings row with an on/off switch; flipping it only changes the draft. */
function SwitchSetting({ title, text, on, onFlip }: { title: string; text: string; on: boolean; onFlip: (on: boolean) => void }) {
  return (
    <div className="ex-settings-row">
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      <div className="form-check form-switch m-0">
        <input className="form-check-input" type="checkbox" role="switch" aria-label={title} checked={on} onChange={(e) => onFlip(e.target.checked)} />
      </div>
    </div>
  )
}

/**
 * Etherscan's settings card: the choices apply when "Save Preferences" is pressed. Unsaved edits are kept as a draft
 * over the stored preferences, so the form never shows a value it has not been told about.
 */
export function SettingsForm() {
  const stored = usePrefs()
  const [draft, setDraft] = useState<Partial<Prefs>>({})
  const [saved, setSaved] = useState(false)
  const shown: Prefs = { ...stored, ...draft }

  const edit = (patch: Partial<Prefs>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(false)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setPrefs(draft)
        setDraft({})
        setSaved(true)
      }}
    >
      <div className="card mb-3">
        <div className="card-body">
          <SelectSetting row={THEME} value={shown.theme} onPick={(v) => edit({ theme: v })} />
          <SelectSetting row={AGE} value={shown.age} onPick={(v) => edit({ age: v })} />
          <SelectSetting row={AMOUNT} value={shown.amount} onPick={(v) => edit({ amount: v })} />
          <SelectSetting row={FEE} value={shown.fee} onPick={(v) => edit({ fee: v })} />
          <SwitchSetting
            title="Address and Method Highlight"
            text="Highlight all occurrences of an address or method in a given page upon hover"
            on={shown.highlight === 'on'}
            onFlip={(on) => edit({ highlight: on ? 'on' : 'off' })}
          />
          <hr />
          <SwitchSetting
            title="Lookalike Address Warning"
            text={`Flag addresses on the same page that share their first and last ${LOOKALIKE_CHARS} characters with another address, and show a warning before copying them`}
            on={shown.lookalike === 'on'}
            onFlip={(on) => edit({ lookalike: on ? 'on' : 'off' })}
          />
        </div>
        <div className="card-footer align-items-center">
          {saved && (
            <span className="ex-settings-saved fs-sm me-auto" role="status">
              Preferences saved.
            </span>
          )}
          <button type="submit" className="btn btn-primary">
            Save Preferences
          </button>
        </div>
      </div>
    </form>
  )
}
