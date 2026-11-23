import { describe, expect, it } from 'vitest'
import { cleanI18nText, i18nFormValue, pickText } from '../../app/utils/i18nText'

describe('pickText', () => {
  const name = { en: 'Morning route A', ja: '朝便A' }

  it('prefers the UI locale', () => {
    expect(pickText(name, 'ja')).toBe('朝便A')
    expect(pickText(name, 'en')).toBe('Morning route A')
  })

  it('falls back to the operator languages, then any language', () => {
    expect(pickText(name, 'de', ['ja', 'en'])).toBe('朝便A')
    expect(pickText(name, 'de')).toBe('Morning route A')
  })

  it('skips empty values and handles non-objects', () => {
    expect(pickText({ de: ' ', en: 'x' }, 'de')).toBe('x')
    expect(pickText(null, 'ja')).toBe('')
    expect(pickText('text', 'ja')).toBe('')
    expect(pickText(['a'], 'ja')).toBe('')
  })
})

describe('cleanI18nText', () => {
  it('trims and drops empty languages', () => {
    expect(cleanI18nText({ ja: ' 学校 ', en: '', de: '  ' })).toEqual({ ja: '学校' })
  })

  it('returns null when nothing is left (the database rejects {})', () => {
    expect(cleanI18nText({ ja: '', en: ' ' })).toBeNull()
    expect(cleanI18nText(undefined)).toBeNull()
  })
})

describe('i18nFormValue', () => {
  it('has one entry per language and keeps extra languages', () => {
    expect(i18nFormValue({ en: 'A', ko: 'B' }, ['ja', 'en'])).toEqual({ ja: '', en: 'A', ko: 'B' })
  })
})
