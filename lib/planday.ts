// lib/planday.ts
let cachedToken: { token: string; expiresAt: number } | null = null

export async function getPlandayToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token

  const res = await fetch('https://id.planday.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.PLANDAY_APP_ID!,
      grant_type: 'refresh_token',
      refresh_token: process.env.PLANDAY_REFRESH_TOKEN!,
    }),
  })

  if (!res.ok) throw new Error(`Planday token feil: ${res.status}`)
  const data = await res.json()
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000 }
  return cachedToken.token
}
