// app/api/planday-fields/route.ts
import { NextResponse } from 'next/server'
import { getPlandayToken } from '@/lib/planday'
import { supabaseAdmin } from '@/lib/supabase-admin'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function plandayFetch(path: string, token: string) {
  const url = `https://openapi.planday.com${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-ClientId': process.env.PLANDAY_APP_ID!,
    },
  })
  if (!res.ok) throw new Error(`Planday ${path}: ${res.status}`)
  return res.json()
}

async function fetchAllPages(path: string, token: string) {
  const results: any[] = []
  let offset = 0
  while (true) {
    const data = await plandayFetch(`${path}?limit=50&offset=${offset}`, token)
    const items = data.data ?? []
    const total = data.paging?.total ?? 0
    results.push(...items)
    console.log(`${path}: hentet ${results.length}/${total}`)
    if (results.length >= total || items.length < 50) break
    offset += 50
    await sleep(300)
  }
  return results
}

export async function GET() {
  try {
    const token = await getPlandayToken()

    // Hent avdelinger først
    const deptRes = await fetchAllPages('/hr/v1/Departments', token)
    const deptMap = Object.fromEntries(deptRes.map((d: any) => [d.id, d.name]))

    // Hent KUN aktive ansatte
    const active = await fetchAllPages('/hr/v1/employees', token)
    console.log(`Aktive ansatte totalt: ${active.length}`)

    // Hent detaljer per ansatt i bolker
    const rows: any[] = []
    const batchSize = 10

    for (let i = 0; i < active.length; i += batchSize) {
      const batch = active.slice(i, i + batchSize)
      const detailed = await Promise.all(
        batch.map(async (e: any) => {
          try {
            const res = await plandayFetch(`/hr/v1/employees/${e.id}`, token)
            return res.data
          } catch {
            return e
          }
        })
      )

      for (const e of detailed) {
        const hireDate = e.custom_3148?.value ? new Date(e.custom_3148.value) : null
        const seniorityDays = hireDate
          ? Math.floor((Date.now() - hireDate.getTime()) / 86400000)
          : null
        const seniorityYears = seniorityDays !== null
          ? Math.round(seniorityDays / 365 * 10) / 10
          : null

        rows.push({
          id: e.id,
          first_name: e.firstName ?? '',
          last_name: e.lastName ?? '',
          full_name: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
          email: e.email,
          phone: e.phone ?? e.cellPhone,
          gender: e.gender,
          department_id: e.departments?.[0],
          department_name: deptMap[e.departments?.[0]] ?? 'Ukjent',
          active: true,
          hire_date: e.custom_3148?.value ?? null,
          employment_type: e.custom_3150?.value ?? null,
          work_status: e.custom_3152?.value ?? null,
          salary_type: e.custom_3156?.value ?? null,
          main_workplace: e.custom_3158?.value ?? null,
          job_title: e.custom_222726?.value ?? null,
          hours_per_week: e.custom_222721?.value ?? null,
          employment_relation: e.custom_222723?.value ?? null,
          seniority_days: seniorityDays,
          seniority_years: seniorityYears,
          updated_at: new Date().toISOString(),
        })
      }

      console.log(`Prosessert ${Math.min(i + batchSize, active.length)}/${active.length}`)
      await sleep(500)
    }

    // Sett alle eksisterende til inactive først
    await supabaseAdmin
      .from('employees')
      .update({ active: false })
      .neq('id', 0)

    // Upsert aktive i bolker på 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error } = await supabaseAdmin
        .from('employees')
        .upsert(batch, { onConflict: 'id' })
      if (error) console.error(`Upsert feil batch ${i}:`, error.message)
    }

    return NextResponse.json({
      success: true,
      employees_synced: rows.length,
      sample: rows[0],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}