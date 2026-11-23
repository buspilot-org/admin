import type { StaffRole } from '~/composables/useOperator'

export interface NavItem {
  to: string
  icon: string
  /** i18n key */
  label: string
  roles: StaffRole[]
}

const EDITORS: StaffRole[] = ['owner', 'editor']

// Drivers see today's trips only (admin-console.md, "Users and roles").
export const NAV_ITEMS: NavItem[] = [
  { to: '/', icon: 'mdi-calendar-today', label: 'nav.today', roles: ['owner', 'editor', 'driver'] },
  { to: '/routes', icon: 'mdi-map-marker-path', label: 'nav.routes', roles: EDITORS },
  { to: '/schedule', icon: 'mdi-timetable', label: 'nav.schedule', roles: EDITORS },
  { to: '/vehicles', icon: 'mdi-bus', label: 'nav.vehicles', roles: EDITORS },
  { to: '/audiences', icon: 'mdi-account-group', label: 'nav.audiences', roles: EDITORS },
  { to: '/news', icon: 'mdi-bullhorn', label: 'nav.news', roles: EDITORS },
  { to: '/settings', icon: 'mdi-cog', label: 'nav.settings', roles: ['owner'] },
]

export function navFor(role: StaffRole | null): NavItem[] {
  return role ? NAV_ITEMS.filter(item => item.roles.includes(role)) : []
}
