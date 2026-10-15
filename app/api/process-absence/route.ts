// app/api/process-absence/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { processAbsenceAndCreateTickets } from '@/lib/agent'

export async function POST(req: NextRequest) {
  try {
    const { absence_id } = await req.json()
    console.log('process-absence kalt med:', absence_id)

    if (!absence_id) return NextResponse.json({ error: 'absence_id påkrevd' }, { status: 400 })

    const { data: absence, error } = await supabaseAdmin
      .from('absences')
      .select('id, absence_type, start_date, end_date, is_ongoing, total_days, employee_id')
      .eq('id', String(absence_id))
      .single()

    console.log('Absence fra DB:', JSON.stringify(absence, null, 2))

    if (error || !absence) {
      return NextResponse.json({ error: 'Fant ikke fraværet', detail: error?.message }, { status: 404 })
    }

    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('id, full_name, department_name')
      .eq('id', absence.employee_id)
      .single()

    console.log('Employee fra DB:', JSON.stringify(employee, null, 2))

    if (!employee) {
      return NextResponse.json({ error: 'Fant ikke ansatt' }, { status: 404 })
    }

    const result = await processAbsenceAndCreateTickets({
      absence_id: String(absence.id),
      employee_id: employee.id,
      employee_name: employee.full_name,
      department_name: employee.department_name ?? 'Ukjent avdeling',
      absence_type: absence.absence_type,
      start_date: absence.start_date,
      end_date: absence.end_date,
      is_ongoing: absence.is_ongoing,
    })

    console.log('Resultat:', JSON.stringify(result, null, 2))
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('process-absence exception:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}