import { describe, expect, it } from 'vitest'
import { addDays, daysInRange, holidaysInService, indexesToWeekdays, weekdayIndex, weekdaysToIndexes } from '../../app/utils/calendar'

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

describe('holidaysInService', () => {
  const holidays = [
    { date: '2026-11-03', name: { ja: '文化の日' } }, // Tuesday
    { date: '2026-11-23', name: { ja: '勤労感謝の日' } }, // Monday
    { date: '2027-01-01', name: { ja: '元日' } }, // Friday, in the winter break
    { date: '2027-04-29', name: { ja: '昭和の日' } }, // after the validity range
  ]

  it('lists holidays on service weekdays within the validity range', () => {
    expect(holidaysInService(schoolDays, [], holidays).map(h => h.date)).toEqual(['2026-11-03', '2026-11-23', '2027-01-01'])
  })

  it('leaves out holidays decided by an exception', () => {
    expect(holidaysInService(schoolDays, [winterBreak], holidays).map(h => h.date)).toEqual(['2026-11-03', '2026-11-23'])
  })

  it('leaves out holidays on weekdays without service', () => {
    expect(holidaysInService({ ...schoolDays, weekdays: indexesToWeekdays([1]) }, [], holidays).map(h => h.date)).toEqual(['2026-11-03'])
  })
})

describe('daysInRange', () => {
  it('counts inclusive days', () => {
    expect(daysInRange('2026-12-24', '2027-01-07')).toBe(15)
    expect(daysInRange('2026-11-23', '2026-11-23')).toBe(1)
  })
})

describe('addDays', () => {
  it('moves by calendar days across months and years', () => {
    expect(addDays('2026-11-23', -1)).toBe('2026-11-22')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })
})
