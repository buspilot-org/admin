// View model for the Today page: trip instances grouped per vehicle, the
// current stop, the delay, and warnings that need someone.

import { zonedInstant } from './time'

export interface StopEventLike {
  stop_sequence: number
  state: 'upcoming' | 'approaching' | 'arrived' | 'departed' | 'passed'
  eta: string | null
}

export interface InstanceLike {
  id: string
  service_date: string
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  vehicle_id: string | null
  off_route_since: string | null
  last_confirmed_stop_sequence: number | null
  start_time: number | null
  stop_events: StopEventLike[]
}

export interface VehicleStateLike {
  vehicle_id: string
  recorded_at: string
}

export type Warning =
  | { kind: 'off_route', tripInstanceId: string, vehicleId: string | null, since: string }
  | { kind: 'stale_position', tripInstanceId: string, vehicleId: string, lastSeen: string | null }

/**
 * Off route: an active trip with `off_route_since` set (the engine sets it).
 * Stale position: an active trip whose vehicle has no position, or one older
 * than `staleSeconds`.
 */
export function computeWarnings(
  instances: readonly InstanceLike[],
  states: readonly VehicleStateLike[],
  now: Date,
  staleSeconds: number,
): Warning[] {
  const stateByVehicle = new Map(states.map(s => [s.vehicle_id, s]))
  const warnings: Warning[] = []
  for (const inst of instances) {
    if (inst.status !== 'active') continue
    if (inst.off_route_since) {
      warnings.push({ kind: 'off_route', tripInstanceId: inst.id, vehicleId: inst.vehicle_id, since: inst.off_route_since })
    }
    if (inst.vehicle_id) {
      const state = stateByVehicle.get(inst.vehicle_id)
      const age = state ? (now.getTime() - new Date(state.recorded_at).getTime()) / 1000 : Infinity
      if (age > staleSeconds) {
        warnings.push({
          kind: 'stale_position',
          tripInstanceId: inst.id,
          vehicleId: inst.vehicle_id,
          lastSeen: state?.recorded_at ?? null,
        })
      }
    }
  }
  return warnings
}

const REACHED = new Set(['arrived', 'departed', 'passed'])

/** The stop_sequence the bus is at or last passed, or null before the first stop. */
export function currentStopSequence(inst: Pick<InstanceLike, 'last_confirmed_stop_sequence' | 'stop_events'>): number | null {
  if (inst.last_confirmed_stop_sequence !== null) return inst.last_confirmed_stop_sequence
  const reached = inst.stop_events.filter(e => REACHED.has(e.state)).map(e => e.stop_sequence)
  return reached.length > 0 ? Math.max(...reached) : null
}

/**
 * Delay in whole minutes at the next stop that has an ETA: ETA minus the
 * planned arrival (service date + trip start + the stop's arrival offset).
 * Null when there is no ETA or no schedule to compare with.
 */
export function delayMinutes(
  inst: Pick<InstanceLike, 'service_date' | 'start_time' | 'stop_events'>,
  arrivalOffsets: ReadonlyMap<number, number>,
  timeZone: string,
): number | null {
  if (inst.start_time === null) return null
  const next = [...inst.stop_events]
    .sort((a, b) => a.stop_sequence - b.stop_sequence)
    .find(e => (e.state === 'upcoming' || e.state === 'approaching') && e.eta)
  if (!next?.eta) return null
  const offset = arrivalOffsets.get(next.stop_sequence)
  if (offset === undefined) return null
  const planned = zonedInstant(inst.service_date, inst.start_time + offset, timeZone)
  return Math.round((new Date(next.eta).getTime() - planned.getTime()) / 60_000)
}

/** Groups items by vehicle id; items without a vehicle go under `null`, listed last. */
export function groupByVehicle<T extends { vehicle_id: string | null }>(items: readonly T[]): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>()
  for (const item of items) {
    const list = groups.get(item.vehicle_id) ?? []
    list.push(item)
    groups.set(item.vehicle_id, list)
  }
  const unassigned = groups.get(null)
  if (unassigned) {
    groups.delete(null)
    groups.set(null, unassigned)
  }
  return groups
}
