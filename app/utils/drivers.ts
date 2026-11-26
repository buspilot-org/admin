// Drivers and their vehicles (driver_vehicle).

/** What to insert and delete to get from the current set of ids to the desired one. */
export function diffIds(current: readonly string[], desired: readonly string[]): { add: string[], remove: string[] } {
  const cur = new Set(current)
  const want = new Set(desired)
  return {
    add: [...want].filter(id => !cur.has(id)),
    remove: [...cur].filter(id => !want.has(id)),
  }
}

/**
 * A label for a staff member. The schema has no staff names or emails yet
 * (staff management is a later step), so others are told apart by the start
 * of their user id.
 */
export function staffLabel(userId: string, ownUserId: string | null, labels: { you: string, driver: string }): string {
  if (userId === ownUserId) return labels.you
  return `${labels.driver} ${userId.slice(0, 8)}`
}
