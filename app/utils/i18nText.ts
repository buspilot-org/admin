// Translatable text is stored as jsonb keyed by language: {"ja": "…", "en": "…"}.

export type I18nText = Record<string, string>

function asText(value: unknown): I18nText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: I18nText = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string') out[key] = val
  }
  return out
}

/**
 * The text in the first language that has it: the UI locale, then the given
 * fallbacks (usually the operator's languages), then any language.
 */
export function pickText(value: unknown, locale: string, fallbacks: readonly string[] = []): string {
  const text = asText(value)
  for (const lang of [locale, ...fallbacks]) {
    const v = text[lang]?.trim()
    if (v) return v
  }
  return Object.values(text).find(v => v.trim())?.trim() ?? ''
}

/** Trims values and drops empty languages. Returns null when nothing is left (the database rejects `{}`). */
export function cleanI18nText(value: unknown): I18nText | null {
  const out: I18nText = {}
  for (const [key, val] of Object.entries(asText(value))) {
    const trimmed = val.trim()
    if (trimmed) out[key] = trimmed
  }
  return Object.keys(out).length > 0 ? out : null
}

/** A copy with one entry per language, empty strings for missing ones (for edit forms). */
export function i18nFormValue(value: unknown, languages: readonly string[]): I18nText {
  const text = asText(value)
  const out: I18nText = {}
  for (const lang of languages) out[lang] = text[lang] ?? ''
  // Keep languages the operator no longer lists, so editing does not drop them.
  for (const [key, val] of Object.entries(text)) if (!(key in out)) out[key] = val
  return out
}
