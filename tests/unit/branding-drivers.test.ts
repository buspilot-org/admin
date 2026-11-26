import { describe, expect, it } from 'vitest'
import {
  BRANDING_MAX_BYTES,
  brandingObjectPath,
  brandingPathFromUrl,
  checkBrandingImage,
  isBrandingUrl,
  readBranding,
  staleBrandingPaths,
} from '../../app/utils/branding'
import { diffIds, staffLabel } from '../../app/utils/drivers'

const OP = 'd0000000-0000-4000-8000-000000000001'

describe('branding images', () => {
  it('accepts PNG, JPEG and WebP up to 2 MiB, as the bucket does', () => {
    expect(checkBrandingImage({ type: 'image/png', size: 1000 })).toBeNull()
    expect(checkBrandingImage({ type: 'image/webp', size: BRANDING_MAX_BYTES })).toBeNull()
    expect(checkBrandingImage({ type: 'image/jpeg', size: BRANDING_MAX_BYTES + 1 })).toBe('size')
    expect(checkBrandingImage({ type: 'image/svg+xml', size: 10 })).toBe('type')
    expect(checkBrandingImage({ type: 'image/gif', size: 10 })).toBe('type')
  })

  it('stores each upload under the operator id with a new name (Storage policy)', () => {
    expect(brandingObjectPath(OP, 'logo', 'image/png', 1)).toBe(`${OP}/logo-1.png`)
    expect(brandingObjectPath(OP, 'cover', 'image/jpeg', 2)).toBe(`${OP}/cover-2.jpg`)
    expect(() => brandingObjectPath(OP, 'logo', 'image/gif', 3)).toThrow()
  })

  it('finds the files the saved branding no longer uses', () => {
    const base = `https://x.supabase.co/storage/v1/object/public/operator-branding/${OP}`
    expect(brandingPathFromUrl(`${base}/logo-2.png?v=1`)).toBe(`${OP}/logo-2.png`)
    expect(brandingPathFromUrl('https://elsewhere.example/logo.png')).toBeNull()
    const files = ['logo.png', 'logo-1.png', 'logo-2.webp', 'cover-3.jpg', 'notes.txt']
    expect(staleBrandingPaths(OP, files, [`${base}/logo-2.webp`, null])).toEqual([`${OP}/logo.png`, `${OP}/logo-1.png`, `${OP}/cover-3.jpg`])
    expect(staleBrandingPaths(OP, files, [`${base}/logo-2.webp`, `${base}/cover-3.jpg`])).toEqual([`${OP}/logo.png`, `${OP}/logo-1.png`])
  })

  it('reads only the documented branding keys', () => {
    expect(readBranding({ color: '1e6fd9', text_color: 'FFFFFF', logo_url: 'https://a/b.png', extra: 1 }))
      .toEqual({ logo_url: 'https://a/b.png', cover_url: null, color: '1E6FD9', text_color: 'FFFFFF' })
    expect(readBranding({ color: '#1E6FD9' }).color).toBeNull()
    expect(readBranding(null)).toEqual({ logo_url: null, cover_url: null, color: null, text_color: null })
  })

  it('accepts only https URLs (schema check)', () => {
    expect(isBrandingUrl('https://x.supabase.co/a.png')).toBe(true)
    expect(isBrandingUrl('http://127.0.0.1:55321/a.png')).toBe(false)
  })
})

describe('drivers', () => {
  it('diffs assignments', () => {
    expect(diffIds(['a', 'b'], ['b', 'c'])).toEqual({ add: ['c'], remove: ['a'] })
    expect(diffIds([], [])).toEqual({ add: [], remove: [] })
  })

  it('labels staff without names', () => {
    const labels = { you: 'You', driver: 'Driver' }
    expect(staffLabel('u1', 'u1', labels)).toBe('You')
    expect(staffLabel('b90b43d6-859e-4907', 'u1', labels)).toBe('Driver b90b43d6')
  })
})
