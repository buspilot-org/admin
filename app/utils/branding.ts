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

/** "<operator id>/logo.png": the first segment decides whose file it is (Storage policy). */
export function brandingObjectPath(operatorId: string, kind: BrandingImageKind, mime: string): string {
  const ext = BRANDING_TYPES[mime as BrandingMime]
  if (!ext) throw new Error(`Unsupported image type ${mime}`)
  return `${operatorId}/${kind}.${ext}`
}

/** The other files of the same kind (another extension), to delete after an upload. */
export function otherBrandingPaths(operatorId: string, kind: BrandingImageKind, keepPath: string | null): string[] {
  return [...new Set(Object.values(BRANDING_TYPES))]
    .map(ext => `${operatorId}/${kind}.${ext}`)
    .filter(p => p !== keepPath)
}

/** A public URL that changes with each upload, so caches show the new image. */
export function versionedUrl(publicUrl: string, version: number | string): string {
  const url = new URL(publicUrl)
  url.searchParams.set('v', String(version))
  return url.toString()
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
