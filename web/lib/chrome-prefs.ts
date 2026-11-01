/**
 * Display preferences (TEAM.md §3): one localStorage key, `ex:prefs`, a JSON object. Each key is mirrored onto
 * <html> as `data-ex-<key>` so CSS can show the matching variant; the server renders both variants and the defaults.
 *
 * `theme` is special: `auto` follows the system (dark system → dim, as Etherscan), and it also drives Bootstrap's
 * `data-bs-theme` (light, or dark for dim and dark). The stored choice itself is mirrored as `data-ex-theme-pref`, so
 * the theme button can show "Auto" while the page is drawn dim.
 *
 * Shared by the server (the boot script string and the defaults on <html>) and the browser (the setters below).
 */

export const PREFS_KEY = 'ex:prefs'

/** Every key and its allowed values; the first value is the default. */
export const PREF_VALUES = {
  theme: ['light', 'dim', 'dark', 'auto'],
  age: ['age', 'datetime'],
  amount: ['amount', 'usd'],
  fee: ['fee', 'gasprice'],
  highlight: ['on', 'off'],
  lookalike: ['on', 'off'],
} as const

export type PrefKey = keyof typeof PREF_VALUES
export type Prefs = { [K in PrefKey]: (typeof PREF_VALUES)[K][number] }
export type ThemePref = Prefs['theme']
export type DrawnTheme = 'light' | 'dim' | 'dark'

/** Every key, in the order the boot script applies them. */
export const PREF_KEYS: readonly PrefKey[] = ['theme', 'age', 'amount', 'fee', 'highlight', 'lookalike']

export const DEFAULT_PREFS: Prefs = {
  theme: 'light',
  age: 'age',
  amount: 'amount',
  fee: 'fee',
  highlight: 'on',
  lookalike: 'on',
}

/** What the server writes on <html> before the boot script runs (the defaults). */
export const HTML_DEFAULT_ATTRS = {
  'data-bs-theme': 'light',
  'data-ex-theme': 'light',
  'data-ex-theme-pref': 'light',
  'data-ex-age': 'age',
  'data-ex-amount': 'amount',
  'data-ex-fee': 'fee',
  'data-ex-highlight': 'on',
  'data-ex-lookalike': 'on',
} as const

/** The system setting that `auto` follows. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

/**
 * The inline <head> script: reads ex:prefs and sets the <html> attributes before the first paint. Built only from the
 * constants above (no request or user input reaches it). Storage that is disabled (privacy modes throw on access) or
 * holds broken JSON leaves the server's defaults in place, which is the right outcome for both.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement,A=${JSON.stringify(PREF_VALUES)},p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(
  PREFS_KEY,
)})||"{}")||{}}catch(e){}for(var k in A){var v=p[k];if(A[k].indexOf(v)<0)v=A[k][0];if(k==="theme"){d.setAttribute("data-ex-theme-pref",v);if(v==="auto")v=matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches?"dim":"light";d.setAttribute("data-ex-theme",v);d.setAttribute("data-bs-theme",v==="light"?"light":"dark")}else d.setAttribute("data-ex-"+k,v)}})()`

function isValue<K extends PrefKey>(key: K, v: unknown): v is Prefs[K] {
  return PREF_VALUES[key].some((x) => x === v)
}

/** One key of a parsed object: its value when it is one of the allowed ones, else the default. */
function pick<K extends PrefKey>(obj: object, key: K): Prefs[K] {
  // A missing key has no descriptor; its value is then undefined and fails isValue like any other bad value.
  const v: unknown = Object.getOwnPropertyDescriptor(obj, key)?.value
  return isValue(key, v) ? v : DEFAULT_PREFS[key]
}

/** Parses the stored JSON; unknown keys are ignored and missing or invalid values fall back to the defaults. */
export function parsePrefs(raw: string): Prefs {
  if (!raw) return { ...DEFAULT_PREFS }
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    // Hand-edited or truncated storage: the defaults stand, exactly as the boot script does on the same input.
    return { ...DEFAULT_PREFS }
  }
  if (typeof obj !== 'object' || obj === null) return { ...DEFAULT_PREFS }
  return {
    theme: pick(obj, 'theme'),
    age: pick(obj, 'age'),
    amount: pick(obj, 'amount'),
    fee: pick(obj, 'fee'),
    highlight: pick(obj, 'highlight'),
    lookalike: pick(obj, 'lookalike'),
  }
}

/** The theme actually drawn for a stored choice; `auto` asks the system. Browser only. */
export function drawnTheme(t: ThemePref): DrawnTheme {
  if (t !== 'auto') return t
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dim' : 'light'
}

/** Puts every pref on <html> (the same result as the boot script). Browser only. */
export function applyPrefs(p: Prefs): void {
  const d = document.documentElement
  const t = drawnTheme(p.theme)
  d.setAttribute('data-ex-theme-pref', p.theme)
  d.setAttribute('data-ex-theme', t)
  d.setAttribute('data-bs-theme', t === 'light' ? 'light' : 'dark')
  for (const k of PREF_KEYS) if (k !== 'theme') d.setAttribute(`data-ex-${k}`, p[k])
}

const CHANGE_EVENT = 'ex:prefs-change'

/**
 * The raw stored string ('' when nothing is stored). Kept as the raw string so it is a stable snapshot for
 * useSyncExternalStore. Browser only.
 */
export function readPrefsRaw(): string {
  try {
    return localStorage.getItem(PREFS_KEY) ?? ''
  } catch {
    // Storage disabled by the browser (SecurityError): the page runs on the defaults, as the boot script does.
    return ''
  }
}

export const readPrefs = (): Prefs => parsePrefs(readPrefsRaw())

/** Saves the given prefs, applies them to <html> at once, and tells every subscriber in this tab. Browser only. */
export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next: Prefs = { ...readPrefs(), ...patch }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    // Storage disabled or full: the choice still applies to this page view, it just is not remembered.
  }
  applyPrefs(next)
  window.dispatchEvent(new Event(CHANGE_EVENT))
  return next
}

/** One pref: writes `ex:prefs` and sets its <html> attribute at once (e.g. setPref('age', 'datetime')). */
export function setPref<K extends PrefKey>(key: K, value: Prefs[K]): Prefs {
  const patch: Partial<Prefs> = {}
  patch[key] = value
  return setPrefs(patch)
}

/** useSyncExternalStore subscription: this tab's writes, other tabs' writes, and the system theme for `auto`. */
export function subscribePrefs(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

