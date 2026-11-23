import type { StaffRole } from '~/composables/useOperator'

declare module '#app' {
  interface PageMeta {
    /** Roles that may open the page. Missing = any staff role. */
    roles?: StaffRole[]
    /** Page needs no signed-in user (sign-in). */
    public?: boolean
  }
}

// Signed-in users without a staff role see /no-access; pages that need a
// role the user does not have send them to Today. RLS enforces the same rules
// on the data; this only keeps the navigation honest.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public) return
  // Read the session from the client: right after sign-in the module's
  // reactive user is filled asynchronously.
  const { data } = await useSupabaseClient().auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return navigateTo('/login')

  const op = useOperator()
  try {
    await op.load(userId)
  }
  catch {
    // Network or API error: pages for all staff show their own error state;
    // pages limited to some roles are not opened without knowing the role.
    return to.meta.roles && to.path !== '/' ? navigateTo('/') : undefined
  }

  if (!op.operator.value) {
    return to.path === '/no-access' ? undefined : navigateTo('/no-access')
  }
  if (to.path === '/no-access') return navigateTo('/')
  const roles = to.meta.roles
  if (roles && (!op.role.value || !roles.includes(op.role.value))) {
    return navigateTo('/')
  }
})
