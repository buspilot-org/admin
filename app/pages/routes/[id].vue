<script setup lang="ts">
// Route detail: patterns, stops in pattern order (a stop served twice is
// listed twice) and the map.
import type { Database } from '~/types/database.types'
import type { MapStop } from '~/components/RouteMap.vue'

definePageMeta({ roles: ['owner', 'editor'] })

type T = Database['public']['Tables']
type RouteRow = T['route']['Row']
type PatternRow = T['trip_pattern']['Row'] & {
  shape: { geom: unknown } | null
  pattern_stop: (T['pattern_stop']['Row'] & { stop: { id: string, name: unknown } | null })[]
}

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const routeParam = useRoute()
const op = useOperator()
const text = useText()

const route = shallowRef<RouteRow | null>(null)
const patterns = shallowRef<PatternRow[]>([])
const locations = ref(new Map<string, LngLat>())
const selected = ref<string | null>(null)
const dialog = ref(false)
const id = computed(() => String(routeParam.params.id))

const { loading, error, reload } = useOperatorLoader(async (operatorId, isStale) => {
  const [r, p] = await Promise.all([
    supabase.from('route').select('*').eq('id', id.value).eq('operator_id', operatorId).maybeSingle(),
    supabase
      .from('trip_pattern')
      .select('*, shape(geom), pattern_stop(*, stop(id, name))')
      .eq('route_id', id.value)
      .eq('operator_id', operatorId)
      .order('name'),
  ])
  if (isStale()) return
  if (r.error) throw r.error
  if (p.error) throw p.error
  route.value = r.data
  patterns.value = (p.data as unknown as PatternRow[]).map(pt => ({
    ...pt,
    pattern_stop: [...pt.pattern_stop].sort((a, b) => a.stop_sequence - b.stop_sequence),
  }))
  if (!patterns.value.some(pt => pt.id === selected.value)) selected.value = patterns.value[0]?.id ?? null

  const stopIds = [...new Set(patterns.value.flatMap(pt => pt.pattern_stop.map(ps => ps.stop_id)))]
  const map = new Map<string, LngLat>()
  if (stopIds.length > 0) {
    const loc = await supabase.from('stop_location').select('id, location').in('id', stopIds)
    if (isStale()) return
    if (loc.error) throw loc.error
    for (const row of loc.data) {
      const g = tryParseWkb(row.location)
      if (row.id && g?.type === 'Point') map.set(row.id, g.coordinates)
    }
  }
  locations.value = map
})

const pattern = computed(() => patterns.value.find(p => p.id === selected.value) ?? null)
const line = computed<LngLat[] | null>(() => {
  const g = tryParseWkb(pattern.value?.shape?.geom)
  return g?.type === 'LineString' ? g.coordinates : null
})
const mapStops = computed<MapStop[]>(() =>
  (pattern.value?.pattern_stop ?? []).flatMap((ps) => {
    const coords = locations.value.get(ps.stop_id)
    return coords ? [{ sequence: ps.stop_sequence, name: text(ps.stop?.name), coordinates: coords }] : []
  }),
)
const visitCount = computed(() => {
  const counts = new Map<string, number>()
  for (const ps of pattern.value?.pattern_stop ?? []) counts.set(ps.stop_id, (counts.get(ps.stop_id) ?? 0) + 1)
  return counts
})
const visibility = computed(() => route.value?.visibility ?? op.operator.value?.default_visibility ?? 'invited_eta')
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" to="/routes" class="mb-2 px-0">{{ t('routes.title') }}</v-btn>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>
    <EmptyState v-if="!loading && !route && !error" icon="mdi-map-marker-question" :title="t('routes.notFound')" />

    <template v-if="route">
      <PageHeader :title="text(route.name)" :subtitle="`${t(`visibility.${visibility}`)}${route.active ? '' : ` · ${t('routes.inactive')}`}`">
        <v-btn variant="tonal" prepend-icon="mdi-pencil" @click="dialog = true">{{ t('common.edit') }}</v-btn>
      </PageHeader>

      <EmptyState v-if="patterns.length === 0" icon="mdi-map-marker-plus" :title="t('routes.noPatterns')" :text="t('routes.noPatternsText')" />

      <template v-else>
        <v-tabs v-if="patterns.length > 1" v-model="selected" class="mb-4">
          <v-tab v-for="p in patterns" :key="p.id" :value="p.id">{{ p.name }}</v-tab>
        </v-tabs>
        <h2 v-else class="text-subtitle-1 mb-2">{{ pattern?.name }}</h2>

        <v-row>
          <v-col cols="12" lg="5">
            <v-card border flat>
              <v-table density="compact" data-testid="pattern-stops">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ t('routes.stop') }}</th>
                    <th>{{ t('routes.arrival') }}</th>
                    <th>{{ t('routes.departure') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="ps in pattern?.pattern_stop ?? []" :key="ps.stop_sequence">
                    <td class="tabular">{{ ps.stop_sequence }}</td>
                    <td>
                      {{ text(ps.stop?.name) }}
                      <v-chip v-if="(visitCount.get(ps.stop_id) ?? 0) > 1" size="x-small" class="ml-1" prepend-icon="mdi-repeat">
                        {{ t('routes.servedTwice') }}
                      </v-chip>
                      <v-icon v-if="!locations.has(ps.stop_id)" icon="mdi-map-marker-off" size="small" :title="t('routes.noLocation')" />
                    </td>
                    <td class="tabular">{{ t('routes.minutesOffset', { n: formatOffset(ps.arrival_offset) }) }}</td>
                    <td class="tabular">{{ t('routes.minutesOffset', { n: formatOffset(ps.departure_offset) }) }}</td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
            <div class="text-caption text-medium-emphasis mt-2">{{ t('routes.offsetsHint') }}</div>
          </v-col>
          <v-col cols="12" lg="7">
            <ClientOnly>
              <RouteMap :line="line" :stops="mapStops" :color="route.color ?? DEFAULT_COLOR" />
            </ClientOnly>
            <div v-if="!line" class="text-caption text-medium-emphasis mt-2">{{ t('routes.noShape') }}</div>
          </v-col>
        </v-row>
      </template>

      <RouteDialog v-model="dialog" :route="route" @saved="reload" />
    </template>
  </div>
</template>
