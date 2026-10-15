'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { colors } from '@/lib/theme'

// Headeren bruker HEIMR-grønn og kobber også i admin

const TABS = [
  { href: '/admin', label: 'Kunnskap' },
  { href: '/admin/partnere', label: 'Partnere' },
  { href: '/admin/sporsmal', label: 'Spørsmål' },
  { href: '/admin/stemme', label: 'Oppsett' },
]

export default function AdminHeader() {
  const pathname = usePathname()
  const [hotelName, setHotelName] = useState('')
  const [open, setOpen] = useState(0)

  useEffect(() => {
    fetch('/api/hotel').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return
      setHotelName(d.hotel.name)
      setOpen(d.openQuestions ?? 0)
    })
  }, [pathname])

  return (
    <header style={{ background: colors.surface, borderBottom: `1px solid ${colors.border}`, padding: '0 16px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/heimr-wordmark.png" alt="HEIMR" width={250} height={45} style={{ height: 14, width: 'auto', display: 'block' }} />
            {hotelName && (
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.accentHover, background: colors.accentSoft, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                {hotelName}
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.muted, whiteSpace: 'nowrap' }}>Admin</span>
          </div>
          <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: colors.text, textDecoration: 'none', padding: '8px 10px', borderRadius: 8, whiteSpace: 'nowrap' }}>
            ← Til chat
          </Link>
        </div>
        <nav style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: -1 }}>
          {TABS.map(t => {
            const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href)
            return (
              <Link key={t.href} href={t.href} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 12px 12px', fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
                color: active ? colors.ink : colors.muted,
                borderBottom: `2px solid ${active ? colors.accent : 'transparent'}`,
              }}>
                {t.label}
                {t.href === '/admin/sporsmal' && open > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, background: colors.accent, color: colors.accentText, borderRadius: 9, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{open}</span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
