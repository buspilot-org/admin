// PostgREST returns PostGIS geography columns as hex-encoded (E)WKB. This
// parser handles the two types the console reads: Point and LineString.

export type LngLat = [number, number]

export type Geometry =
  | { type: 'Point', coordinates: LngLat }
  | { type: 'LineString', coordinates: LngLat[] }

const WKB_POINT = 1
const WKB_LINESTRING = 2
const FLAG_Z = 0x80000000
const FLAG_M = 0x40000000
const FLAG_SRID = 0x20000000

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function parseWkb(hex: string): Geometry {
  const view = new DataView(hexToBytes(hex).buffer)
  let offset = 0
  const little = view.getUint8(offset) === 1
  offset += 1
  const rawType = view.getUint32(offset, little)
  offset += 4

  // ISO WKB encodes Z/M as +1000/+2000/+3000; EWKB as high bits.
  let dims = 2
  if (rawType & FLAG_Z) dims++
  if (rawType & FLAG_M) dims++
  if (rawType & FLAG_SRID) offset += 4
  let type = rawType & 0x0fffffff
  if (type > 1000) {
    const iso = Math.floor(type / 1000)
    dims += iso === 3 ? 2 : 1
    type %= 1000
  }

  const readPoint = (): LngLat => {
    const x = view.getFloat64(offset, little)
    const y = view.getFloat64(offset + 8, little)
    offset += 8 * dims
    return [x, y]
  }

  if (type === WKB_POINT) {
    return { type: 'Point', coordinates: readPoint() }
  }
  if (type === WKB_LINESTRING) {
    const count = view.getUint32(offset, little)
    offset += 4
    const coordinates: LngLat[] = []
    for (let i = 0; i < count; i++) coordinates.push(readPoint())
    return { type: 'LineString', coordinates }
  }
  throw new Error(`Unsupported WKB geometry type ${type}`)
}

/** Parses a geography value from PostgREST, or returns null if it is missing or invalid. */
export function tryParseWkb(value: unknown): Geometry | null {
  if (typeof value !== 'string' || value.length === 0) return null
  try {
    return parseWkb(value)
  }
  catch {
    return null
  }
}

/** Bounding box [west, south, east, north] of a list of coordinates, or null if empty. */
export function bbox(coords: LngLat[]): [number, number, number, number] | null {
  if (coords.length === 0) return null
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [x, y] of coords) {
    w = Math.min(w, x)
    s = Math.min(s, y)
    e = Math.max(e, x)
    n = Math.max(n, y)
  }
  return [w, s, e, n]
}
