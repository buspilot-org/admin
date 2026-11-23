import { describe, expect, it } from 'vitest'
import { inviteJoinUrl, inviteStatus } from '../../app/utils/invite'
import { isValidLinkUrl, postStatus } from '../../app/utils/post'
import { NAV_ITEMS, navFor } from '../../app/utils/navigation'

describe('invite codes', () => {
  it('puts the code into the join link', () => {
    expect(inviteJoinUrl('https://app.buspilot.org/join#code={code}', 'ABCDE-FGHJK')).toBe('https://app.buspilot.org/join#code=ABCDE-FGHJK')
    expect(inviteJoinUrl('https://x.test/j?c=', 'A B')).toBe('https://x.test/j?c=A%20B')
  })

  it('derives the status', () => {
    const now = new Date('2026-11-23T00:00:00Z')
    const code = { revoked_at: null, expires_at: null, max_uses: null, uses: 3 }
    expect(inviteStatus(code, now)).toBe('active')
    expect(inviteStatus({ ...code, revoked_at: '2026-11-01T00:00:00Z' }, now)).toBe('revoked')
    expect(inviteStatus({ ...code, expires_at: '2026-11-22T00:00:00Z' }, now)).toBe('expired')
    expect(inviteStatus({ ...code, max_uses: 3 }, now)).toBe('used_up')
  })
})

describe('posts and links', () => {
  const now = new Date('2026-11-23T00:00:00Z')
  it('derives the post status', () => {
    expect(postStatus({ published_at: null, expires_at: null }, now)).toBe('draft')
    expect(postStatus({ published_at: '2026-11-24T00:00:00Z', expires_at: null }, now)).toBe('scheduled')
    expect(postStatus({ published_at: '2026-11-22T00:00:00Z', expires_at: null }, now)).toBe('published')
    expect(postStatus({ published_at: '2026-11-20T00:00:00Z', expires_at: '2026-11-22T00:00:00Z' }, now)).toBe('expired')
  })

  it('accepts only https, mailto and tel links (schema check)', () => {
    expect(isValidLinkUrl('https://example.org/contact')).toBe(true)
    expect(isValidLinkUrl('mailto:office@example.org')).toBe(true)
    expect(isValidLinkUrl('tel:+81-78-000-0000')).toBe(true)
    expect(isValidLinkUrl('http://example.org')).toBe(false)
    expect(isValidLinkUrl('javascript:alert(1)')).toBe(false)
    expect(isValidLinkUrl('https://')).toBe(false)
  })
})

describe('navigation by role', () => {
  it('shows drivers today only', () => {
    expect(navFor('driver').map(i => i.to)).toEqual(['/'])
  })

  it('shows editors everything but operator settings', () => {
    expect(navFor('editor').map(i => i.to)).not.toContain('/settings')
    expect(navFor('editor')).toHaveLength(NAV_ITEMS.length - 1)
  })

  it('shows owners everything, nobody without a role anything', () => {
    expect(navFor('owner')).toHaveLength(NAV_ITEMS.length)
    expect(navFor(null)).toEqual([])
  })
})
