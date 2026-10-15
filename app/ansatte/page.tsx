'use client'
// app/ansatte/page.tsx

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: number
  full_name: string
  department_name: string
  main_workplace: string
  job_title: string
  hire_date: string
  seniority_years: number
  employment_type: string
  salary_type: string
  active: boolean
  gender: string
  work_status: string
}

interface WorkplaceStats {
  name: string
  count: number
  titles: Record<string, number>
}

const TODAY = new Date().toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function AnsatteOversikt() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .eq('active', true)
      .then(({ data }) => {
        const filtered = (data ?? []).filter(e => {
          const name = e.full_name?.toLowerCase() ?? ''
          const workplace = (e.main_workplace ?? '').toLowerCase()
          const empType = (e.employment_type ?? '').toLowerCase()
          return (
            !name.includes('dummy') &&
            !name.includes('test') &&
            !name.includes('regnskap') &&
            !workplace.includes('dummy') &&
            !workplace.includes('n/a') &&
            !empType.includes('dummy') &&
            e.main_workplace !== null &&
            e.main_workplace !== 'N/A' &&
            e.main_workplace !== 'Dummy bruker' &&
            e.job_title !== null &&
            e.job_title !== 'N/A' &&
            e.job_title !== 'Dummy bruker'
          )
        })
        setEmployees(filtered)
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={{ background: '#F5F0E8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'Georgia, serif', color: '#2C1810', letterSpacing: '0.1em' }}>LASTER...</p>
    </div>
  )

  const totalCount = employees.length
  const avgSeniority = employees.filter(e => e.seniority_years).length > 0
    ? (employees.reduce((sum, e) => sum + (e.seniority_years ?? 0), 0) / employees.filter(e => e.seniority_years).length).toFixed(2)
    : '—'

  const monthlyPaid = employees.filter(e => (e.salary_type ?? '').toLowerCase().includes('fast')).length
  const hourlyPaid = employees.filter(e => (e.salary_type ?? '').toLowerCase().includes('time')).length

  // Grupper per arbeidsplass
  const workplaceMap = new Map<string, WorkplaceStats>()
  for (const e of employees) {
    const wp = e.main_workplace ?? 'Ukjent'
    if (!workplaceMap.has(wp)) workplaceMap.set(wp, { name: wp, count: 0, titles: {} })
    const stats = workplaceMap.get(wp)!
    stats.count++
    if (e.job_title) stats.titles[e.job_title] = (stats.titles[e.job_title] ?? 0) + 1
  }

  const workplaces = Array.from(workplaceMap.values()).sort((a, b) => b.count - a.count)
  const maxCount = Math.max(...workplaces.map(w => w.count), 1)

  // Matrisdata: stillingstitler × lokasjoner
  const allTitles = [...new Set(employees.map(e => e.job_title).filter(Boolean))].sort()
  const allWorkplaces = workplaces.map(w => w.name)

  // Bygg matrise: title -> workplace -> count
  const matrix: Record<string, Record<string, number>> = {}
  for (const e of employees) {
    if (!e.job_title || !e.main_workplace) continue
    if (!matrix[e.job_title]) matrix[e.job_title] = {}
    matrix[e.job_title][e.main_workplace] = (matrix[e.job_title][e.main_workplace] ?? 0) + 1
  }

  // Filtrer titler som har minst én ansatt
  const activeTitles = allTitles.filter(t => Object.values(matrix[t] ?? {}).some(v => v > 0))

  const cell: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'center',
    fontSize: '0.8rem',
    borderBottom: '1px solid #E0D8CC',
    borderRight: '1px solid #E0D8CC',
    color: '#2C1810',
    fontFamily: 'Georgia, serif',
  }

  return (
    <div style={{ background: '#F5F0E8', minHeight: '100vh', fontFamily: 'Georgia, "Times New Roman", serif', color: '#2C1810', padding: '48px 40px' }}>

      {/* Tittel */}
      <h1 style={{ textAlign: 'center', fontSize: '2.8rem', fontWeight: 400, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '48px' }}>
        Oversikt Ansatte
      </h1>

      {/* KPI-kort */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', maxWidth: '1100px', margin: '0 auto 56px' }}>
        <KPICard>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px', lineHeight: 1.6 }}>
            Ansatte per<br />{TODAY.replace(/\//g, '.')}
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 400, lineHeight: 1 }}>{totalCount}</div>
        </KPICard>

        <KPICard>
          <div style={{ fontSize: '2.6rem', marginBottom: '4px' }}>📅</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 400, lineHeight: 1 }}>{avgSeniority}</div>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '8px' }}>Ansiennitet</div>
        </KPICard>

        <KPICard>
          <div style={{ fontSize: '2.6rem', marginBottom: '4px' }}>🧑</div>
          <div style={{ fontSize: '3.5rem', fontWeight: 400, lineHeight: 1 }}>—</div>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '8px' }}>Snittalder</div>
        </KPICard>

        <KPICard>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textDecoration: 'underline', textTransform: 'uppercase' }}>Fastlønn</div>
            <div style={{ fontSize: '3rem', fontWeight: 400, lineHeight: 1 }}>{monthlyPaid}</div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textDecoration: 'underline', textTransform: 'uppercase', marginTop: '4px' }}>Timelønnede</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 400, lineHeight: 1 }}>{hourlyPaid}</div>
          </div>
        </KPICard>
      </div>

      {/* Stolpediagram */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 64px', background: 'white', borderRadius: '12px', padding: '32px 32px 24px', border: '1px solid #E0D8CC' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '200px', paddingBottom: '8px' }}>
          {workplaces.slice(0, 12).map(wp => (
            <div key={wp.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '0.75rem', marginBottom: '6px' }}>{wp.count}</div>
              <div style={{ width: '100%', background: '#C4522A', borderRadius: '4px 4px 0 0', height: `${(wp.count / maxCount) * 160}px` }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
          {workplaces.slice(0, 12).map(wp => (
            <div key={wp.name} style={{ flex: 1, fontSize: '0.65rem', textAlign: 'center', color: '#5C4030', lineHeight: 1.3 }}>
              {wp.name}
            </div>
          ))}
        </div>
      </div>

      {/* Arbeidsstedkort */}
      <h2 style={{ textAlign: 'center', fontSize: '2.8rem', fontWeight: 400, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '40px' }}>
        Per Lokasjon
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '0 auto 80px' }}>
        {workplaces.map(wp => (
          <WorkplaceCard key={wp.name} wp={wp} />
        ))}
      </div>

      {/* Matrise: stillingstitler × lokasjoner */}
      <h2 style={{ textAlign: 'center', fontSize: '2.8rem', fontWeight: 400, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '40px' }}>
        Stillingstitler per Lokasjon
      </h2>

      <div style={{ maxWidth: '100%', overflowX: 'auto', marginBottom: '80px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E0D8CC' }}>
          <thead>
            <tr style={{ background: '#2C1810' }}>
              <th style={{ ...cell, textAlign: 'left', color: 'white', fontWeight: 400, letterSpacing: '0.08em', minWidth: '180px', position: 'sticky', left: 0, background: '#2C1810' }}>
                Stillingstittel
              </th>
              {allWorkplaces.map(wp => (
                <th key={wp} style={{ ...cell, color: 'white', fontWeight: 400, letterSpacing: '0.05em', fontSize: '0.7rem', minWidth: '100px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '120px', verticalAlign: 'bottom' }}>
                  {wp}
                </th>
              ))}
              <th style={{ ...cell, color: 'white', fontWeight: 600, minWidth: '60px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {activeTitles.map((title, i) => {
              const row = matrix[title] ?? {}
              const total = Object.values(row).reduce((s, v) => s + v, 0)
              return (
                <tr key={title} style={{ background: i % 2 === 0 ? 'white' : '#FAF7F2' }}>
                  <td style={{ ...cell, textAlign: 'left', fontWeight: 500, position: 'sticky', left: 0, background: i % 2 === 0 ? 'white' : '#FAF7F2' }}>
                    {title}
                  </td>
                  {allWorkplaces.map(wp => (
                    <td key={wp} style={{ ...cell, background: row[wp] ? '#FFF0E8' : undefined, color: row[wp] ? '#C4522A' : '#CCC', fontWeight: row[wp] ? 600 : 400 }}>
                      {row[wp] ?? '—'}
                    </td>
                  ))}
                  <td style={{ ...cell, fontWeight: 700, background: '#F5F0E8' }}>{total}</td>
                </tr>
              )
            })}
            {/* Totalrad */}
            <tr style={{ background: '#2C1810' }}>
              <td style={{ ...cell, color: 'white', fontWeight: 600, textAlign: 'left', position: 'sticky', left: 0, background: '#2C1810' }}>Total</td>
              {allWorkplaces.map(wp => {
                const total = activeTitles.reduce((s, t) => s + (matrix[t]?.[wp] ?? 0), 0)
                return <td key={wp} style={{ ...cell, color: 'white', fontWeight: 600 }}>{total || '—'}</td>
              })}
              <td style={{ ...cell, color: 'white', fontWeight: 700 }}>{totalCount}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KPICard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1.5px solid #2C1810', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', minHeight: '140px' }}>
      {children}
    </div>
  )
}

function WorkplaceCard({ wp }: { wp: WorkplaceStats }) {
  const sortedTitles = Object.entries(wp.titles).sort((a, b) => b[1] - a[1])
  return (
    <div style={{ background: '#FDFAF5', border: '1.5px solid #2C1810', borderRadius: '16px', padding: '28px 24px' }}>
      <h3 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#C4522A', textAlign: 'center', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase', fontStyle: 'italic' }}>
        {wp.name}
      </h3>
      <p style={{ textAlign: 'center', fontSize: '1rem', color: '#5C4030', marginBottom: '4px', letterSpacing: '0.05em' }}>Antall ansatte</p>
      <p style={{ textAlign: 'center', fontSize: '2.2rem', fontWeight: 400, marginBottom: '20px' }}>{wp.count}</p>
      {sortedTitles.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <tbody>
            {sortedTitles.map(([title, count]) => (
              <tr key={title} style={{ borderBottom: '1px solid #E0D8CC' }}>
                <td style={{ padding: '5px 4px', color: '#2C1810' }}>{title}</td>
                <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 600, color: '#2C1810' }}>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}