'use client'
// app/dashboard/page.tsx

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Ticket {
  id: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'done' | 'dismissed'
  due_date: string
  days_remaining: number
  action_items: string[]
  employee_name: string
  department_name: string
  absence_start: string
  absence_type: string
  ticket_type_name: string
  legal_reference: string
}

const PRIORITY_CONFIG = {
  critical: { label: 'Kritisk', bg: 'bg-red-950', border: 'border-red-700', badge: 'bg-red-700 text-red-100', dot: 'bg-red-500' },
  high:     { label: 'Høy',     bg: 'bg-orange-950', border: 'border-orange-700', badge: 'bg-orange-700 text-orange-100', dot: 'bg-orange-500' },
  medium:   { label: 'Medium',  bg: 'bg-yellow-950', border: 'border-yellow-700', badge: 'bg-yellow-700 text-yellow-100', dot: 'bg-yellow-500' },
  low:      { label: 'Lav',     bg: 'bg-gray-900',   border: 'border-gray-700',   badge: 'bg-gray-700 text-gray-300',    dot: 'bg-gray-500' },
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Åpen',
  in_progress: 'Pågår',
  done: 'Ferdig',
  dismissed: 'Avvist',
}

export default function HRDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTickets = async () => {
    const query = supabase
      .from('hr_ticket_overview')
      .select('*')

    if (filter !== 'all') {
      query.eq('status', filter === 'done' ? 'done' : 'open')
    }

    const { data } = await query
    setTickets(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTickets()

    // Realtime: ny ticket opprettet
    const sub = supabase
      .channel('hr_tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_tickets' }, fetchTickets)
      .subscribe()

    return () => { sub.unsubscribe() }
  }, [filter])

  const updateStatus = async (ticketId: string, status: string) => {
    await supabase
      .from('hr_tickets')
      .update({ status, resolved_at: status === 'done' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', ticketId)
    fetchTickets()
    setSelected(null)
  }

  const openCount = tickets.filter(t => t.status === 'open').length
  const criticalCount = tickets.filter(t => t.status === 'open' && t.priority === 'critical').length
  const overdueCount = tickets.filter(t => t.status === 'open' && t.days_remaining < 0).length

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">HR Oppfølging</h1>
          <p className="text-sm text-gray-500 mt-0.5">Toast Restaurantgruppen · Sykemeldingsoppfølging</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-400 font-medium">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {overdueCount} forfalt
            </span>
          )}
          {criticalCount > 0 && (
            <span className="text-orange-400">{criticalCount} kritiske</span>
          )}
          <span className="text-gray-400">{openCount} åpne tickets</span>
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">

        {/* Ticket-liste */}
        <div className="w-[420px] border-r border-gray-800 flex flex-col flex-shrink-0">

          {/* Filter-tabs */}
          <div className="flex border-b border-gray-800 px-4 pt-3">
            {(['open', 'all', 'done'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                  filter === f ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {{ open: 'Åpne', all: 'Alle', done: 'Ferdig' }[f]}
              </button>
            ))}
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {loading && <p className="text-center text-gray-600 mt-8 text-sm">Laster...</p>}
            {!loading && tickets.length === 0 && (
              <p className="text-center text-gray-600 mt-8 text-sm">Ingen tickets</p>
            )}
            {tickets.map(ticket => {
              const cfg = PRIORITY_CONFIG[ticket.priority]
              const isOverdue = ticket.days_remaining < 0
              const isUrgent = ticket.days_remaining >= 0 && ticket.days_remaining <= 7

              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelected(ticket)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${cfg.bg} ${cfg.border} ${
                    selected?.id === ticket.id ? 'ring-2 ring-white/20' : 'hover:brightness-125'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className={`text-xs font-mono ${isOverdue ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-gray-500'}`}>
                      {isOverdue
                        ? `${Math.abs(ticket.days_remaining)}d forfalt`
                        : ticket.days_remaining === 0
                          ? 'I dag!'
                          : `${ticket.days_remaining}d igjen`
                      }
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-100 leading-snug mb-1">{ticket.title}</p>
                  <p className="text-xs text-gray-500">{ticket.employee_name} · {ticket.department_name}</p>
                  <p className="text-xs text-gray-600 mt-1">Frist {new Date(ticket.due_date).toLocaleDateString('nb-NO')}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Detalj-panel */}
        <div className="flex-1 overflow-y-auto p-8">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-gray-700">
              <div className="text-center">
                <p className="text-5xl mb-4">📋</p>
                <p>Velg en ticket for å se detaljer</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl">
              {/* Ticket-header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${PRIORITY_CONFIG[selected.priority].badge}`}>
                      {PRIORITY_CONFIG[selected.priority].label}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
                      {selected.ticket_type_name}
                    </span>
                    <span className="text-xs text-gray-600">{selected.legal_reference}</span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">{selected.title}</h2>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  {selected.status === 'open' && (
                    <>
                      <button
                        onClick={() => updateStatus(selected.id, 'in_progress')}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        Sett pågår
                      </button>
                      <button
                        onClick={() => updateStatus(selected.id, 'done')}
                        className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        Merk ferdig
                      </button>
                    </>
                  )}
                  {selected.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'done')}
                      className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      Merk ferdig
                    </button>
                  )}
                  {selected.status === 'done' && (
                    <button
                      onClick={() => updateStatus(selected.id, 'open')}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      Gjenåpne
                    </button>
                  )}
                </div>
              </div>

              {/* Info-grid */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Ansatt', value: selected.employee_name },
                  { label: 'Avdeling', value: selected.department_name },
                  { label: 'Fraværstype', value: selected.absence_type },
                  { label: 'Fravær fra', value: new Date(selected.absence_start).toLocaleDateString('nb-NO') },
                  { label: 'Frist', value: new Date(selected.due_date).toLocaleDateString('nb-NO') },
                  {
                    label: 'Dager igjen',
                    value: selected.days_remaining < 0
                      ? `${Math.abs(selected.days_remaining)} dager forfalt`
                      : `${selected.days_remaining} dager`,
                    urgent: selected.days_remaining <= 7,
                  },
                ].map(item => (
                  <div key={item.label} className="bg-gray-900 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                    <p className={`text-sm font-medium ${'urgent' in item && item.urgent ? 'text-orange-400' : 'text-gray-100'}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Beskrivelse */}
              <div className="bg-gray-900 rounded-xl p-5 mb-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Bakgrunn</h3>
                <p className="text-sm text-gray-200 leading-relaxed">{selected.description}</p>
              </div>

              {/* Handlingspunkter */}
              {selected.action_items?.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Hva du må gjøre</h3>
                  <ul className="space-y-2">
                    {selected.action_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-gray-200">
                        <span className="mt-0.5 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
