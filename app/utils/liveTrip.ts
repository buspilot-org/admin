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

export interface StopPlan {
  /** The form's stops in order, each with the stop_sequence to save it at (the full list for save_live_trip). */
  stops: PlannedStop[]
  /** Saved sequences the save removes: stops removed, moved or given another stop. */
  remove: number[]
}

/** Gap between sequences of new trips, so stops can be inserted later without renumbering. */
export const SEQUENCE_STEP = 10

/**
 * The stop_sequence of each row of the form, so that saving the list
 * (save_live_trip matches planned stops by sequence) changes as few stops as
 * possible. A row keeps its stop_sequence (and the riders who follow it) when
 * its stop is unchanged and it stays in order; the server then only updates
 * its times. Rows that moved or got another stop get a free sequence between
 * their neighbours, so the server deletes the old row and inserts a new one
 * (a planned stop cannot change position, and a follower must not end up at
 * another stop).
 */
export function planStops(existing: readonly PlannedStop[], desired: readonly PlannedStopForm[]): StopPlan {
  const bySeq = new Map(existing.map(s => [s.stop_sequence, s]))

  // Keep the most rows with an unchanged stop whose sequences still
  // increase in the new order (longest increasing subsequence), so moving
  // one stop re-creates only that stop ("A B C D" → "D A B C" keeps A, B, C).
  const candidate: (number | null)[] = desired.map((row) => {
    const old = row.origin !== null ? bySeq.get(row.origin) : undefined
    return old && old.stop_id === row.stop_id ? old.stop_sequence : null
  })
  // A saved row listed twice can be kept only once.
  const seen = new Set<number>()
  candidate.forEach((seq, idx) => {
    if (seq === null) return
    if (seen.has(seq)) candidate[idx] = null
    else seen.add(seq)
  })
  const kept: (number | null)[] = desired.map(() => null)
  for (const idx of longestIncreasing(candidate)) kept[idx] = candidate[idx]!

  // New rows need free sequences between the kept ones around them. No
  // sequence of the saved plan is reused in the same save (also not one
  // deleted now), so a rider's app with the plan it just loaded cannot mix up
  // two stops. (The server keeps no history, so a sequence deleted in an
  // earlier save can come back.) When a run does not fit, the next kept row
  // joins the run (it is re-created).
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
  return {
    stops: desired.map((row, idx) => ({ stop_sequence: seqs[idx]!, stop_id: row.stop_id, planned_arrival: row.planned_arrival, planned_departure: row.planned_departure })),
    remove: existing.map(s => s.stop_sequence).filter(seq => !keptSet.has(seq)),
  }
}

/** Indexes of a longest strictly increasing subsequence of the non-null values. */
export function longestIncreasing(values: readonly (number | null)[]): number[] {
  const n = values.length
  const length: number[] = Array.from({ length: n }, () => 0)
  const previous: number[] = Array.from({ length: n }, () => -1)
  let best = -1
  for (let i = 0; i < n; i++) {
    const v = values[i]
    if (v === null || v === undefined) continue
    length[i] = 1
    for (let j = 0; j < i; j++) {
      const w = values[j]
      if (w !== null && w !== undefined && w < v && length[j]! + 1 > length[i]!) {
        length[i] = length[j]! + 1
        previous[i] = j
      }
    }
    if (best < 0 || length[i]! > length[best]!) best = i
  }
  const out: number[] = []
  for (let i = best; i >= 0; i = previous[i]!) out.unshift(i)
  return out
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
 * A planned time as typed ("10:30", "10:30:15", "25:10" for after midnight)
 * on the trip's service date in the operator's time zone, as an ISO
 * timestamp. Empty input is null; unreadable input is undefined.
 */
export function plannedInstant(input: string, serviceDate: string, timeZone: string): string | null | undefined {
  const text = input.trim()
  if (!text) return null
  const m = /^(\d{1,2}:\d{2})(?::(\d{2}))?$/.exec(text)
  const seconds = m ? parseTimeOfDay(m[1]!) : null
  if (seconds === null || (m![2] !== undefined && Number(m![2]) > 59)) return undefined
  return zonedInstant(serviceDate, seconds + Number(m![2] ?? 0), timeZone).toISOString()
}

/**
 * The form value of a planned time: "HH:MM" from the service date's midnight
 * ("25:10" the next day), with ":SS" only when the time has seconds, so
 * saving unchanged times writes nothing.
 */
export function plannedInput(iso: string | null, serviceDate: string, timeZone: string): string {
  if (!iso) return ''
  // Wall-clock time on the instant's local date, plus whole days after the
  // service date (as plannedInstant reads it, also on DST change days).
  const instant = new Date(iso)
  const days = daysInRange(serviceDate, dateInTimeZone(instant, timeZone)) - 1
  if (days < 0) return ''
  const [h, m] = formatClock(instant, timeZone).split(':').map(Number) as [number, number]
  const seconds = instant.getUTCSeconds()
  const hhmm = formatTimeOfDay(days * 86_400 + h * 3600 + m * 60)
  return seconds ? `${hhmm}:${String(seconds).padStart(2, '0')}` : hhmm
}
