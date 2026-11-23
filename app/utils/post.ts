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
