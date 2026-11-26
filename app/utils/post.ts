export type PostStatus = 'draft' | 'scheduled' | 'published' | 'expired'

export function postStatus(post: { published_at: string | null, expires_at: string | null }, now: Date = new Date()): PostStatus {
  if (!post.published_at) return 'draft'
  if (new Date(post.published_at) > now) return 'scheduled'
  if (post.expires_at && new Date(post.expires_at) <= now) return 'expired'
  return 'published'
}

/** operator_link.url must start with https://, mailto: or tel: (schema check). */
export function isValidLinkUrl(url: string): boolean {
  const u = url.trim()
  if (/^https:\/\/[^\s/]+\.[^\s]+$/.test(u)) return true
  if (/^mailto:[^\s@]+@[^\s@]+$/.test(u)) return true
  if (/^tel:\+?[0-9\-() ]{3,}$/.test(u)) return true
  return false
}

export const POST_CATEGORIES = ['cancellation', 'delay', 'general', 'event'] as const
export type PostCategory = (typeof POST_CATEGORIES)[number]

export const POST_CATEGORY_ICON: Record<PostCategory, string> = {
  cancellation: 'mdi-bus-alert',
  delay: 'mdi-clock-alert-outline',
  general: 'mdi-information-outline',
  event: 'mdi-calendar-star',
}

export const POST_CATEGORY_COLOR: Record<PostCategory, string> = {
  cancellation: 'error',
  delay: 'warning',
  general: 'default',
  event: 'info',
}

export type PostTemplate = { kind: 'no_bus_today', date: string } | { kind: 'delay', minutes: number }

export interface PostDraft {
  category: PostCategory
  title: Record<string, string>
  body: Record<string, string>
}

// Texts for riders, in the operator's languages (not the UI language), so
// they live here rather than in the UI translations.
const TEMPLATE_TEXT: Record<string, {
  noBusTitle: string
  noBusBody: (date: string) => string
  delayTitle: string
  delayBody: (minutes: number) => string
}> = {
  ja: {
    noBusTitle: '本日の運行はありません',
    noBusBody: date => `${date}はバスの運行がありません。ご不便をおかけしますが、よろしくお願いいたします。`,
    delayTitle: 'バスが遅れています',
    delayBody: minutes => `バスは約${minutes}分遅れて運行しています。ご迷惑をおかけして申し訳ありません。`,
  },
  en: {
    noBusTitle: 'No bus today',
    noBusBody: date => `There is no bus service on ${date}. We apologise for the inconvenience.`,
    delayTitle: 'Bus delayed',
    delayBody: minutes => `The bus is running about ${minutes} minutes late. We apologise for the delay.`,
  },
  de: {
    noBusTitle: 'Heute kein Bus',
    noBusBody: date => `Am ${date} fährt kein Bus. Wir bitten um Verständnis.`,
    delayTitle: 'Bus verspätet',
    delayBody: minutes => `Der Bus fährt etwa ${minutes} Minuten später. Wir bitten um Entschuldigung.`,
  },
}

/** A YYYY-MM-DD date written out for riders in a language ("11月26日(木)", "Thursday, November 26"). */
export function riderDate(date: string, language: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const weekday = language === 'ja' ? 'short' : 'long'
  return new Intl.DateTimeFormat(language, { month: 'long', day: 'numeric', weekday, timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)))
}

/**
 * Category, title and body of a template in each of the given languages.
 * Languages without template text get empty strings, to be written by hand.
 */
export function postTemplate(template: PostTemplate, languages: readonly string[]): PostDraft {
  const title: Record<string, string> = {}
  const body: Record<string, string> = {}
  for (const lang of languages) {
    const tx = TEMPLATE_TEXT[lang]
    if (!tx) {
      title[lang] = ''
      body[lang] = ''
    }
    else if (template.kind === 'no_bus_today') {
      title[lang] = tx.noBusTitle
      body[lang] = tx.noBusBody(riderDate(template.date, lang))
    }
    else {
      title[lang] = tx.delayTitle
      body[lang] = tx.delayBody(template.minutes)
    }
  }
  return { category: template.kind === 'no_bus_today' ? 'cancellation' : 'delay', title, body }
}
