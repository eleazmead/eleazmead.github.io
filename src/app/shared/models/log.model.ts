export interface LogRow {
  id: string; // UUID v4
  name: string; // First name of initiator
  fullName: string; // Full name of initiator
  event: string; // Human-readable event string
  count: number; // Total persons RSVP-ed
  createdAt: string; // ISO 8601 + 08:00
}
