import type { Database } from '~/types/database.types'

type Tables = Database['public']['Tables']
export type StaffRole = Database['public']['Enums']['staff_role_kind']
export type OperatorRow = Pick<
  Tables['operator']['Row'],
  'id' | 'slug' | 'name' | 'timezone' | 'languages' | 'branding' | 'default_visibility' | 'updated_at'
>

export interface OperatorMembership {
  role: StaffRole
  operator: OperatorRow
}

const STORAGE_KEY = 'buspilot_operator'

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  }
  catch {
    return null
  }
}

function storeId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  }
  catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

/**
 * The operators the signed-in staff member works for, and the one selected in
 * the header. Roles come from `staff_role` (RLS: own rows only for drivers).
 */
export function useOperator() {
  const supabase = useSupabaseClient<Database>()
  const memberships = useState<OperatorMembership[] | null>('operator-memberships', () => null)
  const currentId = useState<string | null>('operator-current', () => null)
  const loadedFor = useState<string | null>('operator-loaded-for', () => null)

  const current = computed(() => memberships.value?.find(m => m.operator.id === currentId.value) ?? null)
  const operator = computed(() => current.value?.operator ?? null)
  const role = computed<StaffRole | null>(() => current.value?.role ?? null)
  const canEdit = computed(() => role.value === 'owner' || role.value === 'editor')
  const isOwner = computed(() => role.value === 'owner')
  const languages = computed(() => operator.value?.languages ?? ['ja'])
  const timezone = computed(() => operator.value?.timezone ?? 'Asia/Tokyo')

  async function load(userId: string, force = false) {
    if (!force && loadedFor.value === userId && memberships.value) return
    const { data, error } = await supabase
      .from('staff_role')
      .select('role, operator:operator_id (id, slug, name, timezone, languages, branding, default_visibility, updated_at)')
      .eq('user_id', userId)
    if (error) throw error
    memberships.value = (data ?? [])
      .filter(r => r.operator)
      .map(r => ({ role: r.role, operator: r.operator as OperatorRow }))
      .sort((a, b) => a.operator.slug.localeCompare(b.operator.slug))
    loadedFor.value = userId
    const stored = readStoredId()
    const ids = memberships.value.map(m => m.operator.id)
    currentId.value = stored && ids.includes(stored) ? stored : (ids[0] ?? null)
  }

  function select(id: string) {
    if (memberships.value?.some(m => m.operator.id === id)) {
      currentId.value = id
      storeId(id)
    }
  }

  /** Replaces the cached operator row after the owner saved settings. */
  function updateOperator(row: OperatorRow) {
    if (!memberships.value) return
    memberships.value = memberships.value.map(m => (m.operator.id === row.id ? { ...m, operator: row } : m))
  }

  function reset() {
    memberships.value = null
    currentId.value = null
    loadedFor.value = null
  }

  return {
    memberships,
    currentId,
    operator,
    role,
    canEdit,
    isOwner,
    languages,
    timezone,
    load,
    select,
    updateOperator,
    reset,
  }
}
