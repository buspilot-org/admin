// WCAG 2 contrast, for the operator and route colours.

/** "1E6FD9" or "#1e6fd9" → "1E6FD9"; null if not a 6-digit hex colour. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null
  const m = /^#?([0-9a-fA-F]{6})$/.exec(input.trim())
  return m ? m[1]!.toUpperCase() : null
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const h = normalizeHex(hex)
  if (!h) throw new Error(`Invalid colour ${hex}`)
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white, whichever reads better on the background. */
export function bestTextColor(background: string): 'FFFFFF' | '000000' {
  return contrastRatio(background, 'FFFFFF') >= contrastRatio(background, '000000') ? 'FFFFFF' : '000000'
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA-large' | 'fail'

/** WCAG level for normal text (AA needs 4.5:1, AAA 7:1; 3:1 is enough only for large text). */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-large'
  return 'fail'
}
