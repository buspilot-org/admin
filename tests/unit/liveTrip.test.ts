import { describe, expect, it } from 'vitest'
import {
  effectiveMapPermission,
  longestIncreasing,
  liveDelayMinutes,
  planStopChanges,
  plannedInput,
  plannedInstant,
  stopTimeErrors,
} from '../../app/utils/liveTrip'
import type { PlannedStop, PlannedStopForm } from '../../app/utils/liveTrip'

const at = (hhmm: string) => `2026-11-26T${hhmm}:00.000Z`
const saved: PlannedStop[] = [
  { stop_sequence: 10, stop_id: 'a', planned_arrival: at('01:00'), planned_departure: at('01:30') },
  { stop_sequence: 20, stop_id: 'b', planned_arrival: at('02:00'), planned_departure: null },
  { stop_sequence: 30, stop_id: 'c', planned_arrival: at('03:00'), planned_departure: null },
]
const asForm = (s: PlannedStop): PlannedStopForm => ({ origin: s.stop_sequence, stop_id: s.stop_id, planned_arrival: s.planned_arrival, planned_departure: s.planned_departure })

describe('planStopChanges', () => {
  it('numbers the stops of a new trip with gaps', () => {
    const rows = ['a', 'b'].map(stop_id => ({ origin: null, stop_id, planned_arrival: null, planned_departure: null }))
    expect(planStopChanges([], rows)).toEqual({
      remove: [],
      update: [],
      insert: [
        { stop_sequence: 10, stop_id: 'a', planned_arrival: null, planned_departure: null },
        { stop_sequence: 20, stop_id: 'b', planned_arrival: null, planned_departure: null },
      ],
    })
  })

  it('does nothing when nothing changed', () => {
    expect(planStopChanges(saved, saved.map(asForm))).toEqual({ remove: [], update: [], insert: [] })
  })

  it('updates times in place, keeping the sequence (and its followers)', () => {
    const rows = saved.map(asForm)
    rows[1] = { ...rows[1]!, planned_arrival: at('02:10') }
    expect(planStopChanges(saved, rows)).toEqual({
      remove: [],
      update: [{ stop_sequence: 20, stop_id: 'b', planned_arrival: at('02:10'), planned_departure: null }],
      insert: [],
    })
  })

  it('treats the same instant in another notation as unchanged', () => {
    const rows = saved.map(asForm)
    rows[0] = { ...rows[0]!, planned_arrival: '2026-11-26T10:00:00+09:00' }
    expect(planStopChanges(saved, rows).update).toEqual([])
  })

  it('inserts a new stop between two kept ones', () => {
    const rows = [asForm(saved[0]!), { origin: null, stop_id: 'x', planned_arrival: null, planned_departure: null }, asForm(saved[1]!), asForm(saved[2]!)]
    const changes = planStopChanges(saved, rows)
    expect(changes.remove).toEqual([])
    expect(changes.insert).toEqual([{ stop_sequence: 15, stop_id: 'x', planned_arrival: null, planned_departure: null }])
  })

  it('re-creates a stop that got another stop, so followers do not move to it', () => {
    const rows = saved.map(asForm)
    rows[1] = { ...rows[1]!, stop_id: 'z' }
    const changes = planStopChanges(saved, rows)
    expect(changes.remove).toEqual([20])
    // Not 20 again: a removed sequence is never reused.
    expect(changes.insert.map(s => [s.stop_sequence, s.stop_id])).toEqual([[19, 'z']])
  })

  it('re-creates only the moved stop when the last one moves to the front', () => {
    const four: PlannedStop[] = [...saved, { stop_sequence: 40, stop_id: 'd', planned_arrival: null, planned_departure: null }]
    const changes = planStopChanges(four, [asForm(four[3]!), ...saved.map(asForm)])
    expect(changes.remove).toEqual([40])
    expect(changes.update).toEqual([])
    expect(changes.insert.map(s => [s.stop_sequence, s.stop_id])).toEqual([[4, 'd']])
  })

  it('re-creates only the moved stop when the first one moves to the end', () => {
    const changes = planStopChanges(saved, [asForm(saved[1]!), asForm(saved[2]!), asForm(saved[0]!)])
    expect(changes.remove).toEqual([10])
    expect(changes.insert.map(s => [s.stop_sequence, s.stop_id])).toEqual([[40, 'a']])
  })

  it('keeps two of three when two stops swap places', () => {
    const changes = planStopChanges(saved, [asForm(saved[1]!), asForm(saved[0]!), asForm(saved[2]!)])
    expect(changes.remove).toHaveLength(1)
    expect(changes.insert).toHaveLength(1)
  })

  it('removes deleted stops and re-creates moved ones', () => {
    // c moved before a, b removed: c keeps its place, a comes after it.
    const changes = planStopChanges(saved, [asForm(saved[2]!), asForm(saved[0]!)])
    expect(changes.remove.sort()).toEqual([10, 20])
    expect(changes.insert.map(s => [s.stop_sequence, s.stop_id])).toEqual([[40, 'a']])
  })

  it('re-creates the following stop when there is no free sequence', () => {
    const tight: PlannedStop[] = [
      { stop_sequence: 0, stop_id: 'a', planned_arrival: null, planned_departure: null },
      { stop_sequence: 1, stop_id: 'b', planned_arrival: null, planned_departure: null },
    ]
    const rows = [asForm(tight[0]!), { origin: null, stop_id: 'x', planned_arrival: null, planned_departure: null }, asForm(tight[1]!)]
    const changes = planStopChanges(tight, rows)
    expect(changes.remove).toEqual([1])
    expect(changes.insert.map(s => [s.stop_sequence, s.stop_id])).toEqual([[11, 'x'], [21, 'b']])
  })

  it('gives every inserted row a distinct, increasing sequence', () => {
    const rows = [
      { origin: null, stop_id: 'p', planned_arrival: null, planned_departure: null },
      asForm(saved[0]!),
      { origin: null, stop_id: 'q', planned_arrival: null, planned_departure: null },
      { origin: null, stop_id: 'r', planned_arrival: null, planned_departure: null },
      asForm(saved[2]!),
    ]
    const changes = planStopChanges(saved, rows)
    const kept = saved.filter(s => !changes.remove.includes(s.stop_sequence)).map(s => s.stop_sequence)
    const all = [...kept, ...changes.insert.map(s => s.stop_sequence)].sort((a, b) => a - b)
    expect(new Set(all).size).toBe(rows.length)
    expect(changes.insert.map(s => s.stop_id)).toEqual(['p', 'q', 'r'])
  })
})

describe('longestIncreasing', () => {
  it('finds a longest increasing run, skipping nulls', () => {
    expect(longestIncreasing([40, 10, 20, 30])).toEqual([1, 2, 3])
    expect(longestIncreasing([null, 5, null, 6])).toEqual([1, 3])
    expect(longestIncreasing([])).toEqual([])
    expect(longestIncreasing([null])).toEqual([])
  })
})

describe('stopTimeErrors', () => {
  it('accepts ordered times and empty ones', () => {
    expect(stopTimeErrors([
      { planned_arrival: null, planned_departure: at('01:00') },
      { planned_arrival: null, planned_departure: null },
      { planned_arrival: at('02:00'), planned_departure: at('02:30') },
    ])).toEqual([null, null, null])
  })

  it('flags a departure before the arrival, a stop before the previous one, and unreadable input', () => {
    expect(stopTimeErrors([
      { planned_arrival: at('01:00'), planned_departure: at('00:50') },
      { planned_arrival: at('03:00'), planned_departure: null },
      { planned_arrival: at('02:00'), planned_departure: null },
      { planned_arrival: null, planned_departure: null, invalid: true },
    ])).toEqual(['departure_before_arrival', null, 'before_previous_stop', 'invalid_time'])
  })
})

describe('map permission of live-trip audiences', () => {
  it('is capped at arrival times on arrival-time-only routes', () => {
    expect(effectiveMapPermission(true, null)).toBe(true)
    expect(effectiveMapPermission(true, 'invited_map')).toBe(true)
    expect(effectiveMapPermission(true, 'invited_eta')).toBe(false)
    expect(effectiveMapPermission(false, 'public')).toBe(false)
  })
})

describe('liveDelayMinutes', () => {
  it('compares the next ETA with the planned arrival', () => {
    const events = [
      { stop_sequence: 10, state: 'departed', eta: null },
      { stop_sequence: 20, state: 'approaching', eta: at('02:07') },
    ]
    expect(liveDelayMinutes(events, saved)).toBe(7)
    expect(liveDelayMinutes([{ stop_sequence: 20, state: 'upcoming', eta: null }], saved)).toBeNull()
    expect(liveDelayMinutes(events, [])).toBeNull()
  })
})

describe('planned times', () => {
  it('reads HH:MM on the service date in the time zone, also after midnight', () => {
    expect(plannedInstant('10:30', '2026-11-26', 'Asia/Tokyo')).toBe('2026-11-26T01:30:00.000Z')
    expect(plannedInstant('25:10', '2026-11-26', 'Asia/Tokyo')).toBe('2026-11-26T16:10:00.000Z')
    expect(plannedInstant('', '2026-11-26', 'Asia/Tokyo')).toBeNull()
    expect(plannedInstant('10.30', '2026-11-26', 'Asia/Tokyo')).toBeUndefined()
    expect(plannedInstant('10:30:15', '2026-11-26', 'Asia/Tokyo')).toBe('2026-11-26T01:30:15.000Z')
    expect(plannedInstant('10:30:75', '2026-11-26', 'Asia/Tokyo')).toBeUndefined()
  })

  it('writes them back the same way', () => {
    expect(plannedInput('2026-11-26T01:30:00.000Z', '2026-11-26', 'Asia/Tokyo')).toBe('10:30')
    expect(plannedInput('2026-11-26T16:10:00.000Z', '2026-11-26', 'Asia/Tokyo')).toBe('25:10')
    expect(plannedInput(null, '2026-11-26', 'Asia/Tokyo')).toBe('')
    // Seconds survive, so an unchanged time is not rewritten.
    expect(plannedInput('2026-11-26T01:30:15.000Z', '2026-11-26', 'Asia/Tokyo')).toBe('10:30:15')
  })
})
