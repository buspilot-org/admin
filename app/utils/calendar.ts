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

/**
 * Whether a calendar runs on a date. Exceptions win over the regular pattern
 * ("removed" wins when both kinds cover the date). National holidays are
 * skipped when the calendar says so and a holiday list is given.
 */
export function runsOn(
  calendar: CalendarLike,
  exceptions: readonly ExceptionLike[],
  date: string,
  nationalHolidays: ReadonlySet<string> = new Set(),
): boolean {
  const covering = exceptions.filter(e => inRange(date, e.start_date, e.end_date))
  if (covering.some(e => e.type === 'removed')) return false
  if (covering.some(e => e.type === 'added')) return true
  if (!inRange(date, calendar.start_date, calendar.end_date)) return false
  if ((calendar.weekdays & (1 << weekdayIndex(date))) === 0) return false
  if (calendar.skip_national_holidays && nationalHolidays.has(date)) return false
  return true
}

/** Number of days in an inclusive date range. */
export function daysInRange(start: string, end: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1
}
