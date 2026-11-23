<script setup lang="ts">
// Audiences: groups of riders with the same access. Member counts only,
// never who the members are (there is nothing to show: devices are anonymous).
import type { Database } from '~/types/database.types'

definePageMeta({ roles: ['owner', 'editor'] })

type AudienceRow = Database['public']['Tables']['audience']['Row'] & {
  audience_route: { can_see_map: boolean, route: { name: unknown, short_name: string | null, color: string | null } | null }[]
  membership: { count: number }[]
  invite_code: { revoked_at: string | null, expires_at: string | null, max_uses: number | null, uses: number }[]
}

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const text = useText()
const notify = useNotify()

const audiences = shallowRef<AudienceRow[]>([])
const SELECT: string = '*, audience_route(can_see_map, route(name, short_name, color)), membership(count), invite_code(revoked_at, expires_at, max_uses, uses)'

const { loading, error } = useOperatorLoader(async (operatorId, isStale) => {
  const { data, error: err } = await supabase
    .from('audience')
    .select(SELECT)
    .eq('operator_id', operatorId)
    .is('membership.revoked_at', null)
    .order('created_at')
  if (isStale()) return
  if (err) throw err
  audiences.value = data as unknown as AudienceRow[]
})

const dialog = ref(false)
const name = ref<I18nText>({})
const busy = ref(false)
function openNew() {
  name.value = i18nFormValue({}, op.languages.value)
  dialog.value = true
}
async function create() {
  const clean = cleanI18nText(name.value)
  if (!clean || !op.currentId.value) return
  busy.value = true
  const { data, error: err } = await supabase.from('audience').insert({ operator_id: op.currentId.value, name: clean }).select('id').single()
  busy.value = false
  if (err) return notify.error(err)
  dialog.value = false
  await navigateTo(`/audiences/${data.id}`)
}
</script>

<template>
  <div>
    <PageHeader :title="t('audiences.title')" :subtitle="t('audiences.subtitle')">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">{{ t('audiences.new') }}</v-btn>
    </PageHeader>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>

    <v-card v-if="audiences.length > 0" border flat>
      <v-table>
        <thead>
          <tr>
            <th>{{ t('audiences.name') }}</th>
            <th>{{ t('audiences.routes') }}</th>
            <th>{{ t('audiences.members') }}</th>
            <th>{{ t('audiences.activeCodes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in audiences" :key="a.id" data-testid="audience-row">
            <td><NuxtLink :to="`/audiences/${a.id}`">{{ text(a.name) }}</NuxtLink></td>
            <td>
              <v-chip v-for="(ar, i) in a.audience_route" :key="i" size="small" class="mr-1" :prepend-icon="ar.can_see_map ? 'mdi-map' : 'mdi-clock-outline'">
                {{ ar.route ? text(ar.route.name) : '' }}
              </v-chip>
              <span v-if="a.audience_route.length === 0" class="text-medium-emphasis">—</span>
            </td>
            <td class="tabular">{{ a.membership[0]?.count ?? 0 }}</td>
            <td class="tabular">{{ a.invite_code.filter(c => inviteStatus(c) === 'active').length }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
    <EmptyState v-else-if="!loading" icon="mdi-account-group" :title="t('audiences.empty')" :text="t('audiences.emptyText')" />

    <v-dialog v-model="dialog" max-width="520">
      <v-card :title="t('audiences.new')">
        <v-card-text>
          <I18nTextField v-model="name" :languages="op.languages.value" :label="t('audiences.name')" required />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" :disabled="!cleanI18nText(name)" @click="create">{{ t('common.create') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
