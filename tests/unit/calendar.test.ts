import { describe, expect, it } from 'vitest'
import { daysInRange, indexesToWeekdays, runsOn, weekdayIndex, weekdaysToIndexes } from '../../app/utils/calendar'

// The seed calendar: Monday–Friday, school year 2026/27, winter break removed.
const schoolDays = { weekdays: 31, start_date: '2026-04-01', end_date: '2027-03-31', skip_national_holidays: true }
const winterBreak = { start_date: '2026-12-24', end_date: '2027-01-07', type: 'removed' as const }

describe('weekdays', () => {
  it('uses Monday as bit 0', () => {
    expect(weekdayIndex('2026-11-23')).toBe(0) // Monday
    expect(weekdayIndex('2026-11-29')).toBe(6) // Sunday
    expect(weekdaysToIndexes(31)).toEqual([0, 1, 2, 3, 4])
    expect(indexesToWeekdays([0, 1, 2, 3, 4])).toBe(31)
    expect(indexesToWeekdays([5, 6, 9])).toBe(96)
  })
})

describe('runsOn', () => {
  it('runs on school days and not on weekends', () => {
    expect(runsOn(schoolDays, [], '2026-11-23')).toBe(true)
    expect(runsOn(schoolDays, [], '2026-11-28')).toBe(false)
  })

  it('does not run outside the validity range', () => {
    expect(runsOn(schoolDays, [], '2026-03-31')).toBe(false)
    expect(runsOn(schoolDays, [], '2027-04-01')).toBe(false)
  })

  it('applies removed date ranges', () => {
    expect(runsOn(schoolDays, [winterBreak], '2026-12-24')).toBe(false)
    expect(runsOn(schoolDays, [winterBreak], '2027-01-07')).toBe(false)
    expect(runsOn(schoolDays, [winterBreak], '2027-01-08')).toBe(true)
  })

  it('adds service on extra days, also outside the pattern', () => {
    const saturdayEvent = { start_date: '2026-11-28', end_date: '2026-11-28', type: 'added' as const }
    expect(runsOn(schoolDays, [saturdayEvent], '2026-11-28')).toBe(true)
  })

  it('lets removed win when both kinds cover a date', () => {
    const added = { start_date: '2026-12-25', end_date: '2026-12-25', type: 'added' as const }
    expect(runsOn(schoolDays, [added, winterBreak], '2026-12-25')).toBe(false)
  })

  it('skips national holidays when given and asked to', () => {
    const holidays = new Set(['2026-11-23']) // Labour Thanksgiving Day
    expect(runsOn(schoolDays, [], '2026-11-23', holidays)).toBe(false)
    expect(runsOn({ ...schoolDays, skip_national_holidays: false }, [], '2026-11-23', holidays)).toBe(true)
  })
})

describe('daysInRange', () => {
  it('counts inclusive days', () => {
    expect(daysInRange('2026-12-24', '2027-01-07')).toBe(15)
    expect(daysInRange('2026-11-23', '2026-11-23')).toBe(1)
  })
})
