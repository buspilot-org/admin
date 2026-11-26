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

interface RevokeRpc {
  rpc: (fn: 'revoke_invite_code', args: { p_invite_code_id: string, p_revoke_memberships: boolean }) => PromiseLike<{ data: number | null, error: unknown }>
}

/**
 * Revokes a code and, if asked, the active memberships made with it, in one
 * server transaction (`revoke_invite_code`). Resolves to the number of
 * memberships revoked.
 */
export async function revokeInviteCode(client: RevokeRpc, inviteCodeId: string, revokeMemberships: boolean): Promise<number> {
  const { data, error } = await client.rpc('revoke_invite_code', {
    p_invite_code_id: inviteCodeId,
    p_revoke_memberships: revokeMemberships,
  })
  if (error) throw error
  return data ?? 0
}
