// Service calendars: weekday bitmask (bit 0 = Monday … bit 6 = Sunday),
// validity range, and exceptions stored as date ranges.

export interface CalendarLike {
  weekdays: number
  start_date: string
  end_date: string
  skip_national_holidays: boolean
}

export interface ExceptionLike {
  start_date: string
  end_date: string
  type: 'added' | 'removed'
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday) of a YYYY-MM-DD date. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const sundayFirst = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return (sundayFirst + 6) % 7
}

export function weekdaysToIndexes(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter(i => (mask & (1 << i)) !== 0)
}

export function indexesToWeekdays(indexes: readonly number[]): number {
  return indexes.reduce((mask, i) => (i >= 0 && i <= 6 ? mask | (1 << i) : mask), 0)
}

const inRange = (date: string, start: string, end: string) => date >= start && date <= end

export interface HolidayLike {
  date: string
  name: unknown
}

/**
 * National holidays on which the calendar would run by its weekdays and
 * validity, and which therefore matter: skipped if the calendar skips
 * holidays, served otherwise. Holidays already removed or added by an
 * exception are left out (the exception decides).
 */
export function holidaysInService<H extends HolidayLike>(
  calendar: Omit<CalendarLike, 'skip_national_holidays'>,
  exceptions: readonly ExceptionLike[],
  holidays: readonly H[],
): H[] {
  return holidays.filter(h =>
    inRange(h.date, calendar.start_date, calendar.end_date)
    && (calendar.weekdays & (1 << weekdayIndex(h.date))) !== 0
    && !exceptions.some(e => inRange(h.date, e.start_date, e.end_date)),
  )
}

/** Number of days in an inclusive date range. */
export function daysInRange(start: string, end: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1
}

/** A YYYY-MM-DD date moved by whole calendar days (no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
