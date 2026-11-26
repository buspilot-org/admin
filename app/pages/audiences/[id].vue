<script setup lang="ts">
// One audience: name, routes with map permission, invite codes.
import type { Database } from '~/types/database.types'

definePageMeta({ roles: ['owner', 'editor'] })

type T = Database['public']['Tables']
type AudienceRow = T['audience']['Row']
type RouteRow = Pick<T['route']['Row'], 'id' | 'name' | 'short_name' | 'color' | 'visibility' | 'active'>
type CodeRow = Omit<T['invite_code']['Row'], 'code_hash'>

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const routeParam = useRoute()
const op = useOperator()
const text = useText()
const notify = useNotify()
const id = computed(() => String(routeParam.params.id))

const audience = shallowRef<AudienceRow | null>(null)
const routes = shallowRef<RouteRow[]>([])
const codes = shallowRef<CodeRow[]>([])
const memberCount = ref(0)
const name = ref<I18nText>({})
const access = ref<Record<string, 'none' | 'eta' | 'map'>>({})
const savedAccess = ref<Record<string, 'none' | 'eta' | 'map'>>({})

const { loading, error, reload } = useOperatorLoader(async (operatorId, isStale) => {
  const [a, r, ar, c, m] = await Promise.all([
    supabase.from('audience').select('*').eq('id', id.value).eq('operator_id', operatorId).maybeSingle(),
    supabase.from('route').select('id, name, short_name, color, visibility, active').eq('operator_id', operatorId).order('sort_order').order('short_name'),
    supabase.from('audience_route').select('route_id, can_see_map').eq('audience_id', id.value),
    // Never select code_hash: the console has no use for it.
    supabase.from('invite_code').select('id, operator_id, audience_id, label, expires_at, max_uses, uses, revoked_at, created_by, created_at').eq('audience_id', id.value).order('created_at', { ascending: false }),
    supabase.from('membership').select('id', { count: 'exact', head: true }).eq('audience_id', id.value).is('revoked_at', null),
  ])
  if (isStale()) return
  for (const res of [a, r, ar, c, m]) if (res.error) throw res.error
  audience.value = a.data
  routes.value = r.data ?? []
  codes.value = c.data ?? []
  memberCount.value = m.count ?? 0
  name.value = i18nFormValue(a.data?.name, op.languages.value)
  const map: Record<string, 'none' | 'eta' | 'map'> = {}
  for (const route of routes.value) map[route.id] = 'none'
  for (const row of ar.data ?? []) map[row.route_id] = row.can_see_map ? 'map' : 'eta'
  access.value = { ...map }
  savedAccess.value = { ...map }
})

const busy = ref(false)
async function saveName() {
  const clean = cleanI18nText(name.value)
  if (!clean || !audience.value) return
  busy.value = true
  const { error: err } = await supabase.from('audience').update({ name: clean }).eq('id', audience.value.id)
  busy.value = false
  if (err) return notify.error(err)
  notify.success(t('common.saved'))
  await reload()
}

const accessChanged = computed(() => Object.keys(access.value).some(k => access.value[k] !== savedAccess.value[k]))
async function saveAccess() {
  if (!audience.value || !op.currentId.value) return
  busy.value = true
  const remove = Object.keys(access.value).filter(k => access.value[k] === 'none' && savedAccess.value[k] !== 'none')
  const upsert = Object.keys(access.value)
    .filter(k => access.value[k] !== 'none' && access.value[k] !== savedAccess.value[k])
    .map(k => ({ operator_id: op.currentId.value!, audience_id: audience.value!.id, route_id: k, can_see_map: access.value[k] === 'map' }))
  const results = await Promise.all([
    remove.length > 0 ? supabase.from('audience_route').delete().eq('audience_id', audience.value.id).in('route_id', remove) : null,
    upsert.length > 0 ? supabase.from('audience_route').upsert(upsert, { onConflict: 'audience_id,route_id' }) : null,
  ])
  busy.value = false
  const err = results.find(r => r?.error)?.error
  if (err) return notify.error(err)
  notify.success(t('common.saved'))
  await reload()
}

const routeVisibility = (r: RouteRow) => r.visibility ?? op.operator.value?.default_visibility ?? 'invited_eta'

// Invite codes
const createOpen = ref(false)
const revoking = ref<CodeRow | null>(null)
const revokeOpen = computed({ get: () => !!revoking.value, set: (v) => {
  if (!v) {
    revoking.value = null
    alsoMemberships.value = false
  }
} })
const alsoMemberships = ref(false)
async function revoke() {
  if (!revoking.value) return
  busy.value = true
  let revokedMemberships: number
  try {
    revokedMemberships = await revokeInviteCode(supabase, revoking.value.id, alsoMemberships.value)
  }
  catch (err) {
    busy.value = false
    return notify.error(err)
  }
  busy.value = false
  const withMemberships = alsoMemberships.value
  revoking.value = null
  alsoMemberships.value = false
  notify.success(withMemberships ? t('invite.revokedWithMemberships', { n: revokedMemberships }) : t('invite.revoked'))
  await reload()
}

const statusColor: Record<InviteStatus, string> = { active: 'success', revoked: 'error', expired: 'default', used_up: 'warning' }
const fmtDate = (iso: string | null) => (iso ? dateInTimeZone(new Date(iso), op.timezone.value) : '—')

// Delete
const deleteOpen = ref(false)
async function deleteAudience() {
  if (!audience.value) return
  busy.value = true
  const { error: err } = await supabase.from('audience').delete().eq('id', audience.value.id)
  busy.value = false
  if (err) return notify.error(err)
  notify.success(t('common.deleted'))
  await navigateTo('/audiences')
}
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/audiences" class="mb-2 px-0">{{ t('audiences.title') }}</v-btn>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>
    <EmptyState v-if="!loading && !audience && !error" icon="mdi-account-question" :title="t('audiences.notFound')" />

    <template v-if="audience">
      <PageHeader :title="text(audience.name)" :subtitle="t('audiences.memberCount', { n: memberCount })">
        <v-btn variant="text" color="error" prepend-icon="mdi-delete" @click="deleteOpen = true">{{ t('common.delete') }}</v-btn>
      </PageHeader>

      <v-row>
        <v-col cols="12" lg="5">
          <v-card border flat :title="t('audiences.nameCard')" class="mb-4">
            <v-card-text>
              <I18nTextField v-model="name" :languages="op.languages.value" :label="t('audiences.name')" required />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="tonal" :loading="busy" :disabled="!cleanI18nText(name)" @click="saveName">{{ t('common.save') }}</v-btn>
            </v-card-actions>
          </v-card>

          <v-card border flat :title="t('audiences.routes')" :subtitle="t('audiences.routesHint')">
            <v-table density="compact">
              <tbody>
                <tr v-for="r in routes" :key="r.id">
                  <td>
                    <span class="color-swatch mr-1" :style="{ background: `#${r.color ?? '888888'}` }" />
                    {{ text(r.name) }}
                    <div class="text-caption text-medium-emphasis">{{ t(`visibility.${routeVisibility(r)}`) }}</div>
                  </td>
                  <td style="width: 1%">
                    <v-btn-toggle v-model="access[r.id]" mandatory density="compact" variant="outlined" divided>
                      <v-btn value="none" size="small">{{ t('audiences.access.none') }}</v-btn>
                      <v-btn value="eta" size="small">{{ t('audiences.access.eta') }}</v-btn>
                      <v-btn value="map" size="small" :disabled="routeVisibility(r) === 'invited_eta'" :title="routeVisibility(r) === 'invited_eta' ? t('audiences.access.mapNeedsVisibility') : ''">
                        {{ t('audiences.access.map') }}
                      </v-btn>
                    </v-btn-toggle>
                  </td>
                </tr>
                <tr v-if="routes.length === 0"><td class="text-medium-emphasis">{{ t('routes.empty') }}</td></tr>
              </tbody>
            </v-table>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="tonal" :loading="busy" :disabled="!accessChanged" @click="saveAccess">{{ t('common.save') }}</v-btn>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col cols="12" lg="7">
          <v-card border flat>
            <v-card-item :title="t('invite.title')" :subtitle="t('invite.subtitle')">
              <template #append>
                <v-btn color="primary" prepend-icon="mdi-qrcode-plus" data-testid="invite-new" @click="createOpen = true">{{ t('invite.new') }}</v-btn>
              </template>
            </v-card-item>
            <v-table density="compact" data-testid="invite-table">
              <thead>
                <tr>
                  <th>{{ t('invite.label') }}</th>
                  <th>{{ t('invite.createdAt') }}</th>
                  <th>{{ t('invite.expires') }}</th>
                  <th>{{ t('invite.uses') }}</th>
                  <th>{{ t('invite.status') }}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in codes" :key="c.id" data-testid="invite-row">
                  <td>{{ c.label || '—' }}</td>
                  <td class="tabular">{{ fmtDate(c.created_at) }}</td>
                  <td class="tabular">{{ fmtDate(c.expires_at) }}</td>
                  <td class="tabular">{{ c.uses }}<template v-if="c.max_uses !== null"> / {{ c.max_uses }}</template></td>
                  <td><v-chip size="small" variant="tonal" :color="statusColor[inviteStatus(c)]">{{ t(`invite.statuses.${inviteStatus(c)}`) }}</v-chip></td>
                  <td class="text-right">
                    <v-btn v-if="!c.revoked_at" size="small" variant="text" color="error" @click="revoking = c">{{ t('invite.revoke') }}</v-btn>
                  </td>
                </tr>
                <tr v-if="codes.length === 0"><td colspan="6" class="text-medium-emphasis">{{ t('invite.none') }}</td></tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>

      <InviteCodeDialog v-model="createOpen" :audience-id="audience.id" :audience-name="text(audience.name)" @created="reload" />

      <ConfirmDialog v-model="revokeOpen" :title="t('invite.revokeTitle')" :text="t('invite.revokeText')" :confirm-label="t('invite.revoke')" :busy="busy" @confirm="revoke">
        <v-card-text class="pt-0">
          <v-checkbox v-model="alsoMemberships" :label="t('invite.revokeMemberships')" hide-details />
        </v-card-text>
      </ConfirmDialog>
      <ConfirmDialog
        v-model="deleteOpen"
        :title="t('audiences.deleteTitle')"
        :text="t('audiences.deleteText', { n: memberCount })"
        :confirm-label="t('common.delete')"
        :busy="busy"
        @confirm="deleteAudience"
      />
    </template>
  </div>
</template>
