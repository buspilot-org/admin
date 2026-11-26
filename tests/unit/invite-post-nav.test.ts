import { describe, expect, it, vi } from 'vitest'
import { inviteJoinUrl, inviteStatus, revokeInviteCode } from '../../app/utils/invite'
import { isValidLinkUrl, postStatus, postTemplate, riderDate } from '../../app/utils/post'
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

describe('revoking invite codes', () => {
  it('calls revoke_invite_code once and returns the memberships revoked', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null })
    await expect(revokeInviteCode({ rpc }, 'code-1', true)).resolves.toBe(3)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('revoke_invite_code', { p_invite_code_id: 'code-1', p_revoke_memberships: true })
  })

  it('throws the server error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'invite code not found or not allowed' } })
    await expect(revokeInviteCode({ rpc }, 'code-1', false)).rejects.toEqual({ message: 'invite code not found or not allowed' })
  })
})

describe('post templates', () => {
  it('writes "no bus today" in the operator languages as a cancellation', () => {
    const draft = postTemplate({ kind: 'no_bus_today', date: '2026-11-26' }, ['ja', 'en', 'ko'])
    expect(draft.category).toBe('cancellation')
    expect(draft.title).toEqual({ ja: '本日の運行はありません', en: 'No bus today', ko: '' })
    expect(draft.body.ja).toBe('11月26日(木)はバスの運行がありません。ご不便をおかけしますが、よろしくお願いいたします。')
    expect(draft.body.en).toContain('Thursday, November 26')
    expect(draft.body.ko).toBe('')
  })

  it('writes the delay with the minutes as a delay', () => {
    const draft = postTemplate({ kind: 'delay', minutes: 15 }, ['ja', 'de'])
    expect(draft.category).toBe('delay')
    expect(draft.body.ja).toContain('約15分')
    expect(draft.body.de).toContain('etwa 15 Minuten')
  })

  it('formats dates for riders without time zone shifts', () => {
    expect(riderDate('2027-01-01', 'de')).toBe('Freitag, 1. Januar')
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
