// Invite codes look like "ABCDE-FGHJK" (server: private.generate_invite_code).

/** The link encoded in the QR code. `{code}` in the template is replaced by the URL-encoded code. */
export function inviteJoinUrl(template: string, code: string): string {
  const encoded = encodeURIComponent(code)
  return template.includes('{code}') ? template.replaceAll('{code}', encoded) : `${template}${encoded}`
}

export type InviteStatus = 'active' | 'revoked' | 'expired' | 'used_up'

export function inviteStatus(
  code: { revoked_at: string | null, expires_at: string | null, max_uses: number | null, uses: number },
  now: Date = new Date(),
): InviteStatus {
  if (code.revoked_at) return 'revoked'
  if (code.expires_at && new Date(code.expires_at) <= now) return 'expired'
  if (code.max_uses !== null && code.uses >= code.max_uses) return 'used_up'
  return 'active'
}
