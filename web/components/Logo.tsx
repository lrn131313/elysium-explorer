import { useId } from 'react'
import { SITE } from '@/lib/site'

/**
 * Own brand mark (placeholder until the owner picks a name): three stacked bars forming an "E". Its colours come from
 * the theme (--ex-logo-*), so dim and dark get a variant that stands out on their dark header.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  // Several marks share a page (header, network button, footer): each gradient needs its own id.
  const gradient = `ex-logo-g-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ex-logo-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ex-logo-to)' }} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${gradient})`} />
      <g style={{ fill: 'var(--ex-logo-bar)' }}>
        <rect x="10" y="10" width="20" height="4.6" rx="2.3" />
        <rect x="10" y="17.7" width="14" height="4.6" rx="2.3" fillOpacity="0.85" />
        <rect x="10" y="25.4" width="20" height="4.6" rx="2.3" />
      </g>
    </svg>
  )
}

export function Logo() {
  return (
    <span className="ex-brand">
      <LogoMark />
      <span>{SITE.name}</span>
    </span>
  )
}
