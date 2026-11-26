// Operator branding (operator.branding) and its images in the
// `operator-branding` Storage bucket.

export const BRANDING_BUCKET = 'operator-branding'
export const BRANDING_MAX_BYTES = 2 * 1024 * 1024
export const BRANDING_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const
export type BrandingImageKind = 'logo' | 'cover'
type BrandingMime = keyof typeof BRANDING_TYPES

export type BrandingImageError = 'type' | 'size'

/** Checks an image before upload, as the bucket does (PNG, JPEG or WebP, at most 2 MiB). */
export function checkBrandingImage(file: { type: string, size: number }): BrandingImageError | null {
  if (!(file.type in BRANDING_TYPES)) return 'type'
  if (file.size > BRANDING_MAX_BYTES) return 'size'
  return null
}

/**
 * The image type from a file's first bytes (PNG, JPEG or WebP), or null. The
 * browser's `file.type` comes from the file name; this checks the content.
 */
export function sniffImageType(bytes: Uint8Array): keyof typeof BRANDING_TYPES | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b)
  if (starts([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return 'image/png'
  if (starts([0xFF, 0xD8, 0xFF])) return 'image/jpeg'
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return null
}

/**
 * "<operator id>/logo-<version>.png": the first segment decides whose file it
 * is (Storage policy). Each upload gets a new name, so the file the apps show
 * stays until the owner saves the new one, and caches never serve an old
 * image under the same URL.
 */
export function brandingObjectPath(operatorId: string, kind: BrandingImageKind, mime: string, version: number | string): string {
  const ext = BRANDING_TYPES[mime as BrandingMime]
  if (!ext) throw new Error(`Unsupported image type ${mime}`)
  return `${operatorId}/${kind}-${version}.${ext}`
}

/** The object path ("<operator id>/logo-1.png") of a public URL in the branding bucket, or null. */
export function brandingPathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/object/public/${BRANDING_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  const path = url.slice(i + marker.length).split(/[?#]/)[0]!
  try {
    return decodeURIComponent(path)
  }
  catch {
    return path
  }
}

/**
 * Files to delete after a successful save: the saved images this save
 * replaced or removed, and images uploaded on this page that were not saved.
 * Only files of the operator's own folder; never one the new branding uses.
 * (No sweep of the folder: another owner's unsaved upload must survive.)
 */
export function replacedBrandingPaths(
  operatorId: string,
  before: readonly (string | null)[],
  after: readonly (string | null)[],
  uploadedHere: readonly string[] = [],
): string[] {
  const keep = new Set(after.map(brandingPathFromUrl).filter((p): p is string => !!p))
  const candidates = [...before.map(brandingPathFromUrl), ...uploadedHere]
  return [...new Set(candidates)]
    .filter((p): p is string => !!p && p.startsWith(`${operatorId}/`) && !keep.has(p))
}

// A type alias (not an interface), so it fits the Json column type.
export type Branding = {
  logo_url: string | null
  cover_url: string | null
  color: string | null
  text_color: string | null
}

/** Reads operator.branding; unknown keys and invalid values are dropped. */
export function readBranding(value: unknown): Branding {
  const o = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const hex = (v: unknown) => (typeof v === 'string' && /^[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : null)
  return { logo_url: str(o.logo_url), cover_url: str(o.cover_url), color: hex(o.color), text_color: hex(o.text_color) }
}

/** The schema accepts https URLs only (operator_branding_check). */
export function isBrandingUrl(url: string): boolean {
  return /^https:\/\/\S+$/.test(url)
}
