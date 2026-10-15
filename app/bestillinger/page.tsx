import BookingsClient, { type GuestRef } from './BookingsClient'

type SP = { guest?: string; name?: string; room?: string; persons?: string; number?: string; arrival?: string; departure?: string }

// Forhåndsutfyll gjest når man kommer fra gjestepanelet (?guest=…&name=…)
export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const initialGuest: GuestRef | null = sp.name
    ? {
        reservationId: sp.guest ?? null,
        number: sp.number ?? null,
        name: sp.name.slice(0, 200),
        room: sp.room ?? null,
        persons: Number(sp.persons) > 0 ? Number(sp.persons) : null,
        arrival: sp.arrival ?? null,
        departure: sp.departure ?? null,
      }
    : null
  return <BookingsClient initialGuest={initialGuest} />
}
