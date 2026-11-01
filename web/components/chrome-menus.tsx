'use client'

import { ArrowRight, Check, ChevronDown, Contrast, Moon, MoonStar, Settings, Sun, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { activeSection, isCurrent, MENUS, type Menu, type MenuItem } from '@/lib/chrome-menu'
import { setPref, type ThemePref } from '@/lib/chrome-prefs'
import { SITE } from '@/lib/site'
import { usePrefs } from './chrome-prefs'
import { Logo, LogoMark } from './Logo'

/** Closes a click-open menu on a click outside `ref` or on Escape. */
function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, open, close])
}

const THEMES: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dim', label: 'Dim', icon: MoonStar },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'Auto (System)', icon: Contrast },
]

/** Light / Dim / Dark / Auto (System); the stored choice is `.active`. Choosing applies at once and keeps the menu open. */
function ThemeOptions() {
  const { theme } = usePrefs()
  return (
    <>
      {THEMES.map((t) => (
        <li key={t.value}>
          <button
            type="button"
            className={`dropdown-item d-flex align-items-center${theme === t.value ? ' active' : ''}`}
            aria-pressed={theme === t.value}
            onClick={() => setPref('theme', t.value)}
          >
            <t.icon size={14} className="dropdown-item-icon" aria-hidden="true" />
            {t.label}
          </button>
        </li>
      ))}
    </>
  )
}

/** Topbar theme button: shows the stored choice's icon (picked by CSS from <html data-ex-theme-pref>, no flicker). */
export function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, useCallback(() => setOpen(false), []))
  return (
    <div ref={ref} className="dropdown">
      <button
        type="button"
        className="btn btn-white ex-topbtn ex-topbtn-theme"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Theme"
        title="Theme"
        onClick={() => setOpen((o) => !o)}
      >
        {THEMES.map((t) => (
          <t.icon key={t.value} size={16} className={`ex-ti ex-ti-${t.value}`} aria-hidden="true" />
        ))}
      </button>
      <ul className={`dropdown-menu dropdown-menu-end${open ? ' show' : ''}`} data-bs-popper="static">
        <ThemeOptions />
        {/* Below 992px the gear button is hidden; Etherscan puts the settings link here instead. */}
        <li className="d-lg-none">
          <hr className="dropdown-divider" />
        </li>
        <li className="d-lg-none">
          <Link href="/settings" className="dropdown-item d-flex align-items-center justify-content-between gap-3" onClick={() => setOpen(false)}>
            Site Settings <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </div>
  )
}

/** Topbar network button: the one network this explorer serves. */
export function NetworkMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, useCallback(() => setOpen(false), []))
  return (
    <div ref={ref} className="dropdown">
      <button
        type="button"
        className="btn btn-white ex-topbtn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Network"
        title={`${SITE.chainName} Mainnet`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ex-net-logo">
          <LogoMark size={16} />
        </span>
      </button>
      <ul className={`dropdown-menu dropdown-menu-end${open ? ' show' : ''}`} data-bs-popper="static">
        <li>
          <Link href="/" className="dropdown-item active d-flex align-items-center justify-content-between gap-3" onClick={() => setOpen(false)}>
            {SITE.chainName} Mainnet <Check size={14} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </div>
  )
}

const DESKTOP = '(min-width: 992px)'

function ItemLink({ it, pathname, onPick }: { it: MenuItem; pathname: string; onPick: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const current = isCurrent(pathname, it.href)
  return (
    <Link href={it.href} className={`dropdown-item${current ? ' active' : ''}`} aria-current={current ? 'page' : undefined} onClick={onPick}>
      {it.icon && <it.icon size={14} className="dropdown-item-icon" aria-hidden="true" />}
      {it.label}
      {it.note !== undefined && <span className="ex-note-sm"> {it.note}</span>}
    </Link>
  )
}

function MenuBody({ m, open, pathname, onPick }: { m: Menu; open: boolean; pathname: string; onPick: (e: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const show = open ? ' show' : ''
  if (m.groups) {
    return (
      <div className={`dropdown-menu ex-mega${show}`} data-bs-popper="static">
        <div className="row">
          {m.groups.map((g) => (
            <div key={g.title} className="col-lg-3 ex-mega-col">
              <h6>{g.title}</h6>
              <ul>
                {g.items.map((it) => (
                  <li key={it.href}>
                    <ItemLink it={it} pathname={pathname} onPick={onPick} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <ul className={`dropdown-menu${show}`} style={{ minWidth: '14rem' }} data-bs-popper="static">
      {(m.items ?? []).map((it, i) =>
        it === 'sep' ? (
          <li key={`sep-${i}`}>
            <hr className="dropdown-divider" />
          </li>
        ) : (
          <li key={it.href}>
            <ItemLink it={it} pathname={pathname} onPick={onPick} />
          </li>
        ),
      )}
    </ul>
  )
}

/**
 * header#masterHeader's navbar. From 992px the menus open on hover (CSS); below it the list sits in a collapse behind
 * the toggler and each menu opens on click. The section of the current page is `.active`.
 */
export function MainNav() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [heldKey, setHeldKey] = useState<string | null>(null)
  const [seenPath, setSeenPath] = useState(pathname)
  const navRef = useRef<HTMLElement>(null)
  useDismiss(navRef, openKey !== null, useCallback(() => setOpenKey(null), []))

  // A new page closes the mobile menu and any open submenu (React's "reset state on prop change" pattern).
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setCollapsed(true)
    setOpenKey(null)
  }

  const section = activeSection(pathname)
  const toggleMenu = (key: string) => {
    // On desktop the menus open on hover; a click on the title only matters in the mobile menu.
    if (window.matchMedia(DESKTOP).matches) return
    setOpenKey((k) => (k === key ? null : key))
  }
  const picked = (key: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Client navigation keeps the pointer over the open menu; shut it until the pointer leaves, as a page load would.
    setHeldKey(key)
    e.currentTarget.blur()
  }

  return (
    <nav ref={navRef} className="navbar navbar-expand-lg" aria-label="Main">
      <div className="container-xxl position-relative">
        <Link className="navbar-brand" href="/" aria-label={`${SITE.name} home`}>
          <Logo />
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="ex-navbar-collapse"
          aria-expanded={!collapsed}
          aria-label="Toggle navigation"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div id="ex-navbar-collapse" className={`collapse navbar-collapse justify-content-end${collapsed ? '' : ' show'}`}>
          <ul className="navbar-nav">
            <li className="nav-item">
              <Link href="/" className={`nav-link${section === 'home' ? ' active' : ''}`} aria-current={pathname === '/' ? 'page' : undefined}>
                Home
              </Link>
            </li>
            {MENUS.map((m) => (
              <li
                key={m.key}
                className={`nav-item dropdown${m.groups ? ' position-static' : ''}${heldKey === m.key ? ' ex-hold' : ''}`}
                onMouseLeave={() => setHeldKey((k) => (k === m.key ? null : k))}
              >
                <button
                  type="button"
                  className={`nav-link${section === m.key ? ' active' : ''}${openKey === m.key ? ' show' : ''}`}
                  aria-expanded={openKey === m.key}
                  onClick={() => toggleMenu(m.key)}
                >
                  {m.label} <ChevronDown size={13} aria-hidden="true" />
                </button>
                <MenuBody m={m} open={openKey === m.key} pathname={pathname} onPick={picked(m.key)} />
              </li>
            ))}
            {/* Etherscan's mobile-only entries: below 992px the gear is hidden, and the menu repeats settings and theme. */}
            <li className="nav-item d-lg-none">
              <hr className="my-2" />
            </li>
            <li className="nav-item d-lg-none">
              <Link href="/settings" className={`nav-link${pathname === '/settings' ? ' active' : ''}`}>
                <span className="d-inline-flex align-items-center gap-1">
                  <Settings size={14} aria-hidden="true" /> Site Settings <ArrowRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </li>
            <li className="nav-item dropdown d-lg-none">
              <button
                type="button"
                className={`nav-link${openKey === 'appearance' ? ' show' : ''}`}
                aria-expanded={openKey === 'appearance'}
                onClick={() => toggleMenu('appearance')}
              >
                Appearance <ChevronDown size={13} aria-hidden="true" />
              </button>
              <ul className={`dropdown-menu${openKey === 'appearance' ? ' show' : ''}`} data-bs-popper="static">
                <ThemeOptions />
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  )
}
