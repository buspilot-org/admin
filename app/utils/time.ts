// Times of day are seconds since local midnight (GTFS style; may exceed 24 h).

const pad = (n: number) => String(n).padStart(2, '0')

/** 27000 → "07:30"; 90000 → "25:00". */
export function formatTimeOfDay(seconds: number): string {
  const total = Math.max(0, Math.round(seconds / 60))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

/** "7:30" / "07:30" / "25:10" → seconds; null if invalid. Limit: below 48 h (schema check). */
export function parseTimeOfDay(input: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(input)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59 || h > 47) return null
  return h * 3600 + min * 60
}

/** Offset from trip start in whole minutes: 330 → "+6" (rounded). */
export function formatOffset(seconds: number): string {
  return `+${Math.round(seconds / 60)}`
}

/** Calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map(p => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** The instant of `secondsSinceMidnight` on local date `date` (YYYY-MM-DD) in `timeZone`. */
export function zonedInstant(date: string, secondsSinceMidnight: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const naive = Date.UTC(y, m - 1, d) + secondsSinceMidnight * 1000
  let result = naive - timeZoneOffsetMs(new Date(naive), timeZone)
  // Second pass for instants near a DST change.
  result = naive - timeZoneOffsetMs(new Date(result), timeZone)
  return new Date(result)
}

/** Local time "HH:MM" of an instant in a time zone. */
export function formatClock(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(typeof instant === 'string' ? new Date(instant) : instant)
}

/** Converts an ISO timestamp to the value of an <input type="datetime-local"> in a time zone. */
export function toLocalInput(iso: string | null, timeZone: string): string {
  if (!iso) return ''
  const instant = new Date(iso)
  const date = dateInTimeZone(instant, timeZone)
  return `${date}T${formatClock(instant, timeZone)}`
}

/** Converts an <input type="datetime-local"> value, read in a time zone, to an ISO timestamp. */
export function fromLocalInput(value: string, timeZone: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  return zonedInstant(m[1]!, Number(m[2]) * 3600 + Number(m[3]) * 60, timeZone).toISOString()
}
