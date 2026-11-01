'use client'

import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import { applyPrefs, DARK_MEDIA_QUERY, parsePrefs, readPrefs, readPrefsRaw, subscribePrefs, type Prefs } from '@/lib/chrome-prefs'

/** The server knows nothing of the browser's storage: it renders the defaults, and React swaps in the stored prefs. */
const serverSnapshot = () => ''

/** The stored display prefs, live (this tab's writes, other tabs' writes). */
export function usePrefs(): Prefs {
  const raw = useSyncExternalStore(subscribePrefs, readPrefsRaw, serverSnapshot)
  return useMemo(() => parsePrefs(raw), [raw])
}

/**
 * Keeps <html>'s pref attributes right after the boot script has run: follows the system theme while the choice is
 * "Auto", and picks up a change made in another tab. Also re-applies them once on mount, because React's development
 * remount resets <html> to the attributes it renders (the defaults); in production that write changes nothing.
 */
export function PrefsSync() {
  useLayoutEffect(() => {
    applyPrefs(readPrefs())
  }, [])

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY)
    const onSystem = () => {
      const p = readPrefs()
      if (p.theme === 'auto') applyPrefs(p)
    }
    const onStorage = () => applyPrefs(readPrefs())
    media.addEventListener('change', onSystem)
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onSystem)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
