// Live (one-off) trips: planned stops, audiences and their checks.

import { daysInRange } from './calendar'
import { dateInTimeZone, formatClock, formatTimeOfDay, parseTimeOfDay, zonedInstant } from './time'

export interface PlannedStop {
  stop_sequence: number
  stop_id: string
  planned_arrival: string | null
  planned_departure: string | null
}

/** A row of the edit form: `origin` is the stop_sequence it was loaded with, null for a new row. */
export interface PlannedStopForm {
  origin: number | null
  stop_id: string
  planned_arrival: string | null
  planned_departure: string | null
}

export interface StopChanges {
  /** Sequences to delete, before anything else. */
  remove: number[]
  /** Rows kept at their sequence whose times changed. */
  update: PlannedStop[]
  /** New rows (also rows moved or given another stop). */
  insert: PlannedStop[]
}

/** Gap between sequences of new trips, so stops can be inserted later without renumbering. */
export const SEQUENCE_STEP = 10

const sameTime = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && new Date(a).getTime() === new Date(b).getTime())

/**
 * How to turn the saved planned stops into the form's list with the fewest
 * changes. A row keeps its stop_sequence (and the riders who follow it) when
 * its stop is unchanged and it stays in order; only its times are updated.
 * Rows that moved or got another stop are deleted and inserted at a free
 * sequence between their neighbours (the server forbids changing a planned
 * stop's position, and a follower must not end up at another stop).
 */
export function planStopChanges(existing: readonly PlannedStop[], desired: readonly PlannedStopForm[]): StopChanges {
  const bySeq = new Map(existing.map(s => [s.stop_sequence, s]))

  // Keep rows with an unchanged stop as long as their sequences increase.
  const kept: (number | null)[] = []
  let last = -1
  for (const row of desired) {
    const old = row.origin !== null ? bySeq.get(row.origin) : undefined
    if (old && old.stop_id === row.stop_id && old.stop_sequence > last && !kept.includes(old.stop_sequence)) {
      kept.push(old.stop_sequence)
      last = old.stop_sequence
    }
    else {
      kept.push(null)
    }
  }

  // New rows need free sequences between the kept ones around them. A
  // sequence used before is never reused, so a rider's app that still has
  // the old plan cannot mix up two stops. When a run does not fit, the next
  // kept row joins the run (it is re-created).
  const used = new Set(existing.map(s => s.stop_sequence))
  const maxUsed = Math.max(0, ...used)
  const seqs: (number | null)[] = [...kept]
  let i = 0
  while (i < seqs.length) {
    if (seqs[i] !== null) {
      i++
      continue
    }
    // stop_sequence may be 0, so the bound below the first row is -1.
    const before = i > 0 ? seqs[i - 1]! : -1
    let end = i
    while (end < seqs.length && seqs[end] === null) end++
    const after = end < seqs.length ? seqs[end]! : null
    const count = end - i
    if (after === null) {
      const base = Math.max(before, maxUsed)
      for (let k = 0; k < count; k++) seqs[i + k] = base + SEQUENCE_STEP * (k + 1)
    }
    else {
      const free: number[] = []
      for (let s = before + 1; s < after; s++) if (!used.has(s)) free.push(s)
      if (free.length < count) {
        seqs[end] = null
        kept[end] = null
        continue
      }
      // Spread the run evenly over the free sequences.
      const step = free.length / count
      for (let k = 0; k < count; k++) seqs[i + k] = free[Math.floor(k * step + (step - 1) / 2)]!
    }
    i = end
  }

  const keptSet = new Set(kept.filter((s): s is number => s !== null))
  const remove = existing.map(s => s.stop_sequence).filter(seq => !keptSet.has(seq))
  const update: PlannedStop[] = []
  const insert: PlannedStop[] = []
  desired.forEach((row, idx) => {
    const seq = seqs[idx]!
    const planned = { stop_sequence: seq, stop_id: row.stop_id, planned_arrival: row.planned_arrival, planned_departure: row.planned_departure }
    if (kept[idx] !== null) {
      const old = bySeq.get(seq)!
      if (!sameTime(old.planned_arrival, row.planned_arrival) || !sameTime(old.planned_departure, row.planned_departure)) update.push(planned)
    }
    else {
      insert.push(planned)
    }
  })
  return { remove, update, insert }
}

export type StopTimeError = 'departure_before_arrival' | 'before_previous_stop' | 'invalid_time'

/**
 * Checks the times of planned stops in order: departure not before arrival
 * (schema check), and no stop before the previous one. Times are ISO
 * timestamps; `invalid` marks rows whose input could not be read.
 */
export function stopTimeErrors(rows: readonly { planned_arrival: string | null, planned_departure: string | null, invalid?: boolean }[]): (StopTimeError | null)[] {
  let previous: number | null = null
  return rows.map((row) => {
    if (row.invalid) return 'invalid_time'
    const arr = row.planned_arrival ? new Date(row.planned_arrival).getTime() : null
    const dep = row.planned_departure ? new Date(row.planned_departure).getTime() : null
    let error: StopTimeError | null = null
    if (arr !== null && dep !== null && dep < arr) error = 'departure_before_arrival'
    else if (previous !== null && (arr ?? dep) !== null && (arr ?? dep)! < previous) error = 'before_previous_stop'
    previous = dep ?? arr ?? previous
    return error
  })
}

/**
 * Whether an audience of a live trip gets the map: a route with visibility
 * invited_eta never shows the map to riders (the server caps it the same
 * way), so the choice is capped at arrival times there.
 */
export function effectiveMapPermission(canSeeMap: boolean, routeVisibility: string | null): boolean {
  return canSeeMap && routeVisibility !== 'invited_eta'
}

/**
 * Delay of a live trip in whole minutes at the next planned stop with an ETA:
 * ETA minus planned arrival (or departure). Null without ETA or plan.
 */
export function liveDelayMinutes(
  stopEvents: readonly { stop_sequence: number, state: string, eta: string | null }[],
  plannedStops: readonly Pick<PlannedStop, 'stop_sequence' | 'planned_arrival' | 'planned_departure'>[],
): number | null {
  const next = [...stopEvents]
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .find(e => (e.state === 'upcoming' || e.state === 'approaching') && e.eta)
  if (!next?.eta) return null
  const plan = plannedStops.find(p => p.stop_sequence === next.stop_sequence)
  const planned = plan?.planned_arrival ?? plan?.planned_departure
  if (!planned) return null
  return Math.round((new Date(next.eta).getTime() - new Date(planned).getTime()) / 60_000)
}

/**
 * A planned time as typed ("10:30", "25:10" for after midnight) on the trip's
 * service date in the operator's time zone, as an ISO timestamp. Empty input
 * is null; unreadable input is undefined.
 */
export function plannedInstant(input: string, serviceDate: string, timeZone: string): string | null | undefined {
  if (!input.trim()) return null
  const seconds = parseTimeOfDay(input)
  if (seconds === null) return undefined
  return zonedInstant(serviceDate, seconds, timeZone).toISOString()
}

/** The form value of a planned time: "HH:MM" from the service date's midnight ("25:10" the next day). */
export function plannedInput(iso: string | null, serviceDate: string, timeZone: string): string {
  if (!iso) return ''
  const instant = new Date(iso)
  const days = daysInRange(serviceDate, dateInTimeZone(instant, timeZone)) - 1
  const [h, m] = formatClock(instant, timeZone).split(':').map(Number) as [number, number]
  return formatTimeOfDay(days * 86_400 + h * 3600 + m * 60)
}
