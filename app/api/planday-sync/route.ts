// app/api/planday-sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPlandayToken } from '@/lib/planday'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SICK_SHIFT_TYPE_IDS = new Set([1259, 1252, 1224, 1245, 1238, 27390])

const SICK_SHIFT_TYPE_NAMES: Record<number, string> = {
  1259: 'SICK - FIRST 16 DAYS (ARBEIDSGIVERPERIODEN)',
  1252: 'SICK AFTER 16 DAYS (NAV)',
  1224: 'SICK CHILD',
  1245: 'SICK WITH SELF-CERTIFICATION',
  1238: 'SICK WITHOUT DOCUMENTATION',
  27390: 'Sykmelding 30%',
}

async function plandayFetch(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`https://openapi.planday.com${path}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-ClientId': process.env.PLANDAY_APP_ID!,
    },
  })
  if (!res.ok) throw new Error(`Planday ${path}: ${res.status}`)
  return res.json()
}

async function fetchAllPages(path: string, token: string, params?: Record<string, string>) {
  const results: any[] = []
  let offset = 0
  while (true) {
    const data = await plandayFetch(path, token, { ...params, limit: '50', offset: String(offset) })
    if (offset === 0) console.log(`${path} paging:`, JSON.stringify(data.paging))
    const items = data.data ?? data.Data ?? []
    results.push(...items)
    if (items.length < 50) break
    offset += 50
  }
  return results
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const to = new Date().toISOString().substring(0, 10)
  const from = body.from ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() - (body.days ?? 30))
    return d.toISOString().substring(0, 10)
  })()

  try {
    const token = await getPlandayToken()

    // Hent ansatte (aktive + deaktiverte)
    const employees = await fetchAllPages('/hr/v1/employees', token)

    // Debug: custom fields
    console.log('Employee eksempel:', JSON.stringify(employees[0], null, 2))
    const customFields = await plandayFetch('/hr/v1/employees/fields', token)
    console.log('Custom fields:', JSON.stringify(customFields, null, 2))
    if (employees[0]) {
      const detailed = await plandayFetch(`/hr/v1/employees/${employees[0].id}`, token)
      console.log('Ansatt med custom fields:', JSON.stringify(detailed, null, 2))
    }

    const deactivated = await fetchAllPages('/hr/v1/employees/deactivated', token)
    const allEmployees = [...employees, ...deactivated]
    console.log(`Aktive: ${employees.length}, deaktiverte: ${deactivated.length}, totalt: ${allEmployees.length}`)

    const departments = await fetchAllPages('/hr/v1/Departments', token)
    const deptMap = Object.fromEntries(departments.map((d: any) => [d.id, d.name]))

    if (allEmployees.length) {
      const { error: empError } = await supabaseAdmin.from('employees').upsert(
        allEmployees.map((e: any) => ({
          id: e.id,
          first_name: e.firstName ?? '',
          last_name: e.lastName ?? '',
          full_name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
          email: e.email,
          department_id: e.departmentId,
          department_name: deptMap[e.departmentId] ?? 'Ukjent',
          active: !(e.deactivated ?? false),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      )
      if (empError) console.error('Ansatt upsert feil:', empError.message)
      else console.log(`Ansatte upsert OK: ${allEmployees.length}`)
    }

    // Hent alle shifts i perioden
    const shifts = await fetchAllPages('/scheduling/v1/shifts', token, { from, to })

    // Filtrer på sykevakter
    const sickShifts = shifts.filter((s: any) => SICK_SHIFT_TYPE_IDS.has(s.shiftTypeId))

    console.log(`Totalt shifts: ${shifts.length}, sykevakter: ${sickShifts.length}`)

    // Grupper sykevakter per ansatt
    const absenceMap = new Map<string, any>()

    for (const shift of sickShifts) {
      const key = `${shift.employeeId}-${shift.shiftTypeId}`
      const existing = absenceMap.get(key)
      const shiftDate = shift.date.substring(0, 10)

      if (!existing) {
        absenceMap.set(key, {
          employee_id: shift.employeeId,
          department_id: shift.departmentId,
          shift_type_id: shift.shiftTypeId,
          absence_type: SICK_SHIFT_TYPE_NAMES[shift.shiftTypeId] ?? 'Sykefravær',
          start_date: shiftDate,
          end_date: shiftDate,
          shifts: [shift],
        })
      } else {
        if (shiftDate > existing.end_date) existing.end_date = shiftDate
        existing.shifts.push(shift)
      }
    }

    const absences = Array.from(absenceMap.values())
    const newAbsenceIds: string[] = []

    for (const a of absences) {
      const totalDays = Math.ceil(
        (new Date(a.end_date).getTime() - new Date(a.start_date).getTime()) / 86400000
      ) + 1

      const absenceId = `${a.employee_id}-${a.shift_type_id}-${a.start_date}`

      const row = {
        id: absenceId,
        employee_id: a.employee_id,
        absence_type: a.absence_type,
        start_date: a.start_date,
        end_date: a.end_date,
        is_ongoing: false,
        total_days: totalDays,
        planday_data: { shifts: a.shifts },
        updated_at: new Date().toISOString(),
      }

      const { data: existing } = await supabaseAdmin
        .from('absences')
        .select('id')
        .eq('id', absenceId)
        .single()

      if (!existing) {
        const { error: insertError } = await supabaseAdmin.from('absences').insert(row)
        if (insertError) {
          console.error(`Insert feil for ${absenceId}:`, insertError.message)
        } else {
          console.log(`Insert OK: ${absenceId}`)
          newAbsenceIds.push(absenceId)
        }
      } else {
        await supabaseAdmin.from('absences').update(row).eq('id', absenceId)
      }
    }

    // Trigger agent for nye sykemeldinger
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const ticketResults = await Promise.allSettled(
      newAbsenceIds.map(async (id) => {
        const res = await fetch(`${baseUrl}/api/process-absence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ absence_id: id }),
        })
        const data = await res.json()
        console.log(`process-absence ${id}:`, JSON.stringify(data))
        return data
      })
    )

    const ticketsCreated = ticketResults.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success: true,
      shifts_synced: sickShifts.length,
      absences_created: absences.length,
      new_absences: newAbsenceIds.length,
      tickets_created: ticketsCreated,
      from, to,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return POST(new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: '2026-05-23' }),
  }) as any)
}