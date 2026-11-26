import { describe, expect, it } from 'vitest'
import { bestTextColor, contrastLevel, contrastRatio, DEFAULT_COLOR, normalizeHex } from '../../app/utils/color'

describe('colour contrast', () => {
  it('normalises hex colours', () => {
    expect(normalizeHex('#1e6fd9')).toBe('1E6FD9')
    expect(normalizeHex('1E6FD9')).toBe('1E6FD9')
    expect(normalizeHex('#fff')).toBeNull()
    expect(normalizeHex('blue')).toBeNull()
    expect(normalizeHex(null)).toBeNull()
  })

  it('computes WCAG ratios', () => {
    expect(contrastRatio('000000', 'FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('FFFFFF', 'FFFFFF')).toBeCloseTo(1, 5)
    // The demo route colour with white text.
    expect(contrastRatio('1E6FD9', 'FFFFFF')).toBeCloseTo(4.85, 2)
  })

  it('maps ratios to levels', () => {
    expect(contrastLevel(7.1)).toBe('AAA')
    expect(contrastLevel(4.5)).toBe('AA')
    expect(contrastLevel(3.2)).toBe('AA-large')
    expect(contrastLevel(2)).toBe('fail')
  })

  it('picks the more readable text colour', () => {
    expect(bestTextColor('1E6FD9')).toBe('FFFFFF')
    expect(bestTextColor('FFE600')).toBe('000000')
  })

  it('uses the brand colour as the default, readable with white text', () => {
    expect(DEFAULT_COLOR).toBe('00777F')
    expect(bestTextColor(DEFAULT_COLOR)).toBe('FFFFFF')
    expect(contrastRatio(DEFAULT_COLOR, 'FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })
})
