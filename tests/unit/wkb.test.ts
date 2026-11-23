import { describe, expect, it } from 'vitest'
import { bbox, parseWkb, tryParseWkb } from '../../app/utils/wkb'

// Values as PostgREST returns them from the seed (EWKB, SRID 4326).
const POINT = '0101000020E6100000151DC9E53FE66040A60A4625755A4140'
const LINE = '0102000020E610000006000000151DC9E53FE66040A60A4625755A4140E3A59BC420E66040A8C64B37895941402063EE5A42E66040FE43FAEDEB584140E02D90A0F8E560408E06F01648584140E3A59BC420E66040A8C64B3789594140BC74931804E6604060E5D022DB594140'

describe('parseWkb', () => {
  it('reads an EWKB point', () => {
    const g = parseWkb(POINT)
    expect(g.type).toBe('Point')
    expect(g.coordinates[0]).toBeCloseTo(135.1953, 6)
    expect(g.coordinates[1]).toBeCloseTo(34.7067, 6)
  })

  it('reads an EWKB line string in order, including a repeated vertex', () => {
    const g = parseWkb(LINE)
    expect(g.type).toBe('LineString')
    if (g.type !== 'LineString') return
    expect(g.coordinates).toHaveLength(6)
    expect(g.coordinates[1]![0]).toBeCloseTo(135.1915, 6)
    expect(g.coordinates[4]![0]).toBeCloseTo(135.1915, 6)
    expect(g.coordinates[5]![1]).toBeCloseTo(34.702, 6)
  })

  it('reads plain big-endian WKB without SRID', () => {
    // POINT(1 2), big endian
    expect(parseWkb('00000000013FF00000000000004000000000000000')).toEqual({ type: 'Point', coordinates: [1, 2] })
  })

  it('skips the Z value of 3D points', () => {
    // EWKB POINT Z (1 2 3), little endian, Z flag set
    expect(parseWkb('0101000080000000000000F03F00000000000000400000000000000840')).toEqual({ type: 'Point', coordinates: [1, 2] })
  })

  it('rejects unsupported types and bad input', () => {
    expect(() => parseWkb('010300000000000000')).toThrow(/Unsupported/)
    expect(() => parseWkb('zz')).toThrow()
    expect(tryParseWkb(null)).toBeNull()
    expect(tryParseWkb('')).toBeNull()
    expect(tryParseWkb('nothex')).toBeNull()
  })
})

describe('bbox', () => {
  it('returns west, south, east, north', () => {
    expect(bbox([[1, 5], [3, 2], [2, 4]])).toEqual([1, 2, 3, 5])
    expect(bbox([])).toBeNull()
  })
})
