<script setup lang="ts">
import type { Database } from '~/types/database.types'

definePageMeta({ roles: ['owner', 'editor'] })

type T = Database['public']['Tables']
type RouteRow = T['route']['Row'] & {
  trip_pattern: { id: string }[]
  audience_route: { can_see_map: boolean, audience: { name: unknown } | null }[]
}

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const text = useText()

const routes = shallowRef<RouteRow[]>([])
const dialog = ref(false)

const { loading, error } = useOperatorLoader(async (operatorId, isStale) => {
  const { data, error: err } = await supabase
    .from('route')
    .select('*, trip_pattern(id), audience_route(can_see_map, audience(name))')
    .eq('operator_id', operatorId)
    .order('sort_order')
    .order('short_name')
  if (isStale()) return
  if (err) throw err
  routes.value = data as unknown as RouteRow[]
})

const effective = (r: RouteRow) => r.visibility ?? op.operator.value?.default_visibility ?? 'invited_eta'

async function created(id: string) {
  await navigateTo(`/routes/${id}`)
}
</script>

<template>
  <div>
    <PageHeader :title="t('routes.title')">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="dialog = true">{{ t('routes.new') }}</v-btn>
    </PageHeader>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>

    <v-card v-if="routes.length > 0" border flat>
      <v-table>
        <thead>
          <tr>
            <th>{{ t('routes.name') }}</th>
            <th>{{ t('routes.visibility') }}</th>
            <th>{{ t('routes.audiences') }}</th>
            <th>{{ t('routes.patterns') }}</th>
            <th>{{ t('routes.active') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in routes" :key="r.id" data-testid="route-row">
            <td>
              <NuxtLink :to="`/routes/${r.id}`" class="d-inline-flex align-center ga-2 text-decoration-none">
                <v-chip
                  size="small"
                  label
                  :style="{ background: `#${r.color ?? '888888'}`, color: `#${r.text_color ?? bestTextColor(r.color ?? '888888')}` }"
                >
                  {{ r.short_name || '—' }}
                </v-chip>
                <span>{{ text(r.name) }}</span>
              </NuxtLink>
            </td>
            <td>
              {{ t(`visibility.${effective(r)}`) }}
              <span v-if="!r.visibility" class="text-caption text-medium-emphasis">({{ t('visibility.inherited') }})</span>
            </td>
            <td>
              <v-chip
                v-for="(ar, i) in r.audience_route"
                :key="i"
                size="small"
                class="mr-1"
                :prepend-icon="ar.can_see_map ? 'mdi-map' : 'mdi-clock-outline'"
              >
                {{ text(ar.audience?.name) }}
              </v-chip>
              <span v-if="r.audience_route.length === 0" class="text-medium-emphasis">—</span>
            </td>
            <td class="tabular">{{ r.trip_pattern.length }}</td>
            <td><v-icon :icon="r.active ? 'mdi-check' : 'mdi-minus'" :aria-label="r.active ? t('common.yes') : t('common.no')" /></td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
    <EmptyState v-else-if="!loading" icon="mdi-map-marker-path" :title="t('routes.empty')" :text="t('routes.emptyText')" />

    <RouteDialog v-model="dialog" :route="null" @saved="created" />
  </div>
</template>
