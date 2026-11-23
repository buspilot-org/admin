import { describe, expect, it } from 'vitest'
import {
  dateInTimeZone,
  formatClock,
  formatOffset,
  formatTimeOfDay,
  fromLocalInput,
  parseTimeOfDay,
  toLocalInput,
  zonedInstant,
} from '../../app/utils/time'

describe('time of day', () => {
  it('formats seconds since midnight, also past 24 h', () => {
    expect(formatTimeOfDay(7 * 3600 + 30 * 60)).toBe('07:30')
    expect(formatTimeOfDay(25 * 3600 + 10 * 60)).toBe('25:10')
    expect(formatTimeOfDay(0)).toBe('00:00')
  })

  it('parses HH:MM and rejects invalid input', () => {
    expect(parseTimeOfDay('7:30')).toBe(27000)
    expect(parseTimeOfDay(' 08:10 ')).toBe(29400)
    expect(parseTimeOfDay('25:00')).toBe(90000)
    expect(parseTimeOfDay('48:00')).toBeNull()
    expect(parseTimeOfDay('07:60')).toBeNull()
    expect(parseTimeOfDay('0730')).toBeNull()
    expect(parseTimeOfDay('')).toBeNull()
  })

  it('formats offsets in whole minutes', () => {
    expect(formatOffset(330)).toBe('+6')
    expect(formatOffset(0)).toBe('+0')
  })
})

describe('time zones', () => {
  it('gives the local date in Tokyo', () => {
    // 2026-11-23 16:00 UTC is 2026-11-24 01:00 in Tokyo.
    expect(dateInTimeZone(new Date('2026-11-23T16:00:00Z'), 'Asia/Tokyo')).toBe('2026-11-24')
    expect(dateInTimeZone(new Date('2026-11-23T14:00:00Z'), 'Asia/Tokyo')).toBe('2026-11-23')
  })

  it('converts local service time to an instant', () => {
    expect(zonedInstant('2026-11-23', 7 * 3600 + 30 * 60, 'Asia/Tokyo').toISOString()).toBe('2026-11-22T22:30:00.000Z')
    expect(zonedInstant('2026-11-23', 25 * 3600, 'Asia/Tokyo').toISOString()).toBe('2026-11-23T16:00:00.000Z')
  })

  it('handles a zone with daylight saving time', () => {
    // Berlin is UTC+2 in summer, UTC+1 in winter.
    expect(zonedInstant('2026-07-01', 8 * 3600, 'Europe/Berlin').toISOString()).toBe('2026-07-01T06:00:00.000Z')
    expect(zonedInstant('2026-12-01', 8 * 3600, 'Europe/Berlin').toISOString()).toBe('2026-12-01T07:00:00.000Z')
  })

  it('round-trips datetime-local values in the operator time zone', () => {
    expect(fromLocalInput('2026-11-23T09:00', 'Asia/Tokyo')).toBe('2026-11-23T00:00:00.000Z')
    expect(toLocalInput('2026-11-23T00:00:00Z', 'Asia/Tokyo')).toBe('2026-11-23T09:00')
    expect(toLocalInput(null, 'Asia/Tokyo')).toBe('')
    expect(fromLocalInput('', 'Asia/Tokyo')).toBeNull()
    expect(formatClock('2026-11-23T12:20:00Z', 'Asia/Tokyo')).toBe('21:20')
  })
})
