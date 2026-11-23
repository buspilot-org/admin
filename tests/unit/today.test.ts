import { describe, expect, it } from 'vitest'
import { computeWarnings, currentStopSequence, delayMinutes, groupByVehicle } from '../../app/utils/today'
import type { InstanceLike } from '../../app/utils/today'

const base: InstanceLike = {
  id: 'i1',
  service_date: '2026-11-23',
  status: 'active',
  vehicle_id: 'v1',
  off_route_since: null,
  last_confirmed_stop_sequence: null,
  start_time: 7 * 3600 + 30 * 60,
  stop_events: [],
}
const now = new Date('2026-11-22T22:40:00Z') // 07:40 in Tokyo

describe('computeWarnings', () => {
  it('reports an active trip that is off route', () => {
    const w = computeWarnings([{ ...base, off_route_since: '2026-11-22T22:35:00Z' }], [{ vehicle_id: 'v1', recorded_at: '2026-11-22T22:39:50Z' }], now, 120)
    expect(w).toEqual([{ kind: 'off_route', tripInstanceId: 'i1', vehicleId: 'v1', since: '2026-11-22T22:35:00Z' }])
  })

  it('reports a stale or missing position during an active trip', () => {
    expect(computeWarnings([base], [{ vehicle_id: 'v1', recorded_at: '2026-11-22T22:30:00Z' }], now, 120)[0]).toMatchObject({ kind: 'stale_position', lastSeen: '2026-11-22T22:30:00Z' })
    expect(computeWarnings([base], [], now, 120)[0]).toMatchObject({ kind: 'stale_position', lastSeen: null })
  })

  it('ignores fresh positions and trips that are not running', () => {
    expect(computeWarnings([base], [{ vehicle_id: 'v1', recorded_at: '2026-11-22T22:39:00Z' }], now, 120)).toEqual([])
    expect(computeWarnings([{ ...base, status: 'planned', off_route_since: 'x' }], [], now, 120)).toEqual([])
    expect(computeWarnings([{ ...base, vehicle_id: null }], [], now, 120)).toEqual([])
  })
})

describe('currentStopSequence', () => {
  it('uses the engine’s last confirmed stop', () => {
    expect(currentStopSequence({ last_confirmed_stop_sequence: 3, stop_events: [] })).toBe(3)
  })

  it('falls back to the last reached stop event', () => {
    expect(currentStopSequence({
      last_confirmed_stop_sequence: null,
      stop_events: [
        { stop_sequence: 1, state: 'departed', eta: null },
        { stop_sequence: 2, state: 'passed', eta: null },
        { stop_sequence: 3, state: 'approaching', eta: null },
      ],
    })).toBe(2)
    expect(currentStopSequence({ last_confirmed_stop_sequence: null, stop_events: [] })).toBeNull()
  })
})

describe('delayMinutes', () => {
  const offsets = new Map([[1, 0], [2, 300], [3, 540]])

  it('compares the next ETA with the planned arrival', () => {
    // Stop 2 planned 07:35 Tokyo = 22:35 UTC; ETA 22:38 → 3 min late.
    const inst = { ...base, stop_events: [
      { stop_sequence: 1, state: 'departed' as const, eta: null },
      { stop_sequence: 3, state: 'upcoming' as const, eta: '2026-11-22T22:41:00Z' },
      { stop_sequence: 2, state: 'approaching' as const, eta: '2026-11-22T22:38:00Z' },
    ] }
    expect(delayMinutes(inst, offsets, 'Asia/Tokyo')).toBe(3)
  })

  it('returns early arrivals as negative and null without data', () => {
    const early = { ...base, stop_events: [{ stop_sequence: 2, state: 'upcoming' as const, eta: '2026-11-22T22:33:00Z' }] }
    expect(delayMinutes(early, offsets, 'Asia/Tokyo')).toBe(-2)
    expect(delayMinutes({ ...base, stop_events: [] }, offsets, 'Asia/Tokyo')).toBeNull()
    expect(delayMinutes({ ...early, start_time: null }, offsets, 'Asia/Tokyo')).toBeNull()
    expect(delayMinutes(early, new Map(), 'Asia/Tokyo')).toBeNull()
  })
})

describe('groupByVehicle', () => {
  it('groups by vehicle and lists unassigned trips last', () => {
    const groups = groupByVehicle([{ vehicle_id: null, n: 1 }, { vehicle_id: 'a', n: 2 }, { vehicle_id: 'a', n: 3 }])
    expect([...groups.keys()]).toEqual(['a', null])
    expect(groups.get('a')!.map(x => x.n)).toEqual([2, 3])
  })
})
