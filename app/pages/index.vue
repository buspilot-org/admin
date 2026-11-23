<script setup lang="ts">
// Today: trip instances per vehicle with status, current stop and delay, and
// warnings that need someone. Live state is written by the engine; until it
// runs, the page shows what the schedule says.
import type { Database } from '~/types/database.types'
import type { InstanceLike, Warning } from '~/utils/today'

type T = Database['public']['Tables']
type InstanceRow = T['trip_instance']['Row'] & {
  trip: Pick<T['trip']['Row'], 'start_time' | 'headsign'> | null
  route: Pick<T['route']['Row'], 'name' | 'short_name' | 'color' | 'text_color'> | null
  stop_events: InstanceLike['stop_events']
}
type PatternStopRow = Pick<T['pattern_stop']['Row'], 'pattern_id' | 'stop_sequence' | 'arrival_offset'> & {
  stop: { name: unknown } | null
}

// A plain string keeps the type checker from expanding the nested select.
const INSTANCE_SELECT: string = '*, trip(start_time, headsign), route(name, short_name, color, text_color), stop_events:stop_event(stop_sequence, state, eta)'

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const config = useRuntimeConfig()
const op = useOperator()
const text = useText()
const { loadSchedule } = useScheduleData()

const today = ref('')
const now = ref(new Date())
const instances = shallowRef<InstanceRow[]>([])
const vehicles = shallowRef<Pick<T['vehicle']['Row'], 'id' | 'name' | 'active'>[]>([])
const states = shallowRef<Pick<T['vehicle_state']['Row'], 'vehicle_id' | 'recorded_at' | 'speed_kmh'>[]>([])
const patternStops = shallowRef<PatternStopRow[]>([])
const plannedOnly = shallowRef<{ id: string, start_time: number, pattern: string, route: PatternRowRoute | null }[]>([])
type PatternRowRoute = { name: unknown, short_name: string | null, color: string | null, text_color: string | null }

const { loading, error, reload } = useOperatorLoader(async (operatorId) => {
  now.value = new Date()
  today.value = dateInTimeZone(now.value, op.timezone.value)
  const [inst, veh, st, schedule] = await Promise.all([
    supabase
      .from('trip_instance')
      .select(INSTANCE_SELECT)
      .eq('operator_id', operatorId)
      .eq('service_date', today.value),
    supabase.from('vehicle').select('id, name, active').eq('operator_id', operatorId).order('name'),
    supabase.from('vehicle_state').select('vehicle_id, recorded_at, speed_kmh').eq('operator_id', operatorId),
    loadSchedule(operatorId),
  ])
  if (inst.error) throw inst.error
  if (veh.error) throw veh.error
  if (st.error) throw st.error
  instances.value = (inst.data as unknown as InstanceRow[]).sort(
    (a, b) => (a.trip?.start_time ?? 0) - (b.trip?.start_time ?? 0),
  )
  vehicles.value = veh.data
  states.value = st.data

  const patternIds = [...new Set(instances.value.map(i => i.pattern_id).filter((id): id is string => !!id))]
  if (patternIds.length > 0) {
    const ps = await supabase
      .from('pattern_stop')
      .select('pattern_id, stop_sequence, arrival_offset, stop(name)')
      .in('pattern_id', patternIds)
    if (ps.error) throw ps.error
    patternStops.value = ps.data as unknown as PatternStopRow[]
  }
  else {
    patternStops.value = []
  }

  // Scheduled trips the engine has not created an instance for (yet).
  const created = new Set(instances.value.map(i => i.trip_id))
  const patternById = new Map(schedule.patterns.map(p => [p.id, p]))
  plannedOnly.value = tripsOnDate(schedule.trips, schedule.calendars, today.value)
    .filter(trip => !created.has(trip.id))
    .map(trip => ({
      id: trip.id,
      start_time: trip.start_time,
      pattern: patternById.get(trip.pattern_id)?.name ?? '',
      route: patternById.get(trip.pattern_id)?.route ?? null,
    }))
})

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  // Refresh every 30 s. Live updates with Realtime are a follow-up.
  timer = setInterval(reload, 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

const vehicleName = (id: string | null) => (id ? vehicles.value.find(v => v.id === id)?.name ?? '—' : t('today.noVehicle'))

const viewInstances = computed(() => instances.value.map(i => ({ ...i, start_time: i.trip?.start_time ?? null })))
const warnings = computed<Warning[]>(() =>
  computeWarnings(viewInstances.value, states.value, now.value, Number(config.public.stalePositionSeconds)),
)
const groups = computed(() => [...groupByVehicle(viewInstances.value).entries()])

function stopName(patternId: string | null, sequence: number | null) {
  if (!patternId || sequence === null) return null
  const ps = patternStops.value.find(p => p.pattern_id === patternId && p.stop_sequence === sequence)
  return ps ? `${sequence}. ${text(ps.stop?.name)}` : `${sequence}.`
}

function delay(inst: (typeof viewInstances.value)[number]) {
  if (inst.status !== 'active' || !inst.pattern_id) return null
  const offsets = new Map(patternStops.value.filter(p => p.pattern_id === inst.pattern_id).map(p => [p.stop_sequence, p.arrival_offset]))
  return delayMinutes(inst, offsets, op.timezone.value)
}

function tripLabel(inst: InstanceRow) {
  if (inst.kind === 'live') return text(inst.title) || t('today.liveTrip')
  return inst.trip ? formatTimeOfDay(inst.trip.start_time) : '—'
}

const statusColor: Record<string, string> = { planned: 'default', active: 'primary', completed: 'success', cancelled: 'error' }
</script>

<template>
  <div>
    <PageHeader :title="t('today.title')" :subtitle="today ? t('today.date', { date: today }) : ''">
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="reload">{{ t('common.refresh') }}</v-btn>
    </PageHeader>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>

    <section class="mb-6" :aria-label="t('today.warnings')">
      <h2 class="text-subtitle-1 mb-2">{{ t('today.warnings') }}</h2>
      <v-alert
        v-for="w in warnings"
        :key="`${w.kind}-${w.tripInstanceId}`"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-2"
        data-testid="warning"
      >
        <template v-if="w.kind === 'off_route'">
          {{ t('today.offRoute', { vehicle: vehicleName(w.vehicleId), since: formatClock(w.since, op.timezone.value) }) }}
        </template>
        <template v-else>
          {{ w.lastSeen
            ? t('today.stale', { vehicle: vehicleName(w.vehicleId), time: formatClock(w.lastSeen, op.timezone.value) })
            : t('today.noPosition', { vehicle: vehicleName(w.vehicleId) }) }}
        </template>
      </v-alert>
      <div v-if="warnings.length === 0" class="text-body-2 text-medium-emphasis">{{ t('today.noWarnings') }}</div>
    </section>

    <section :aria-label="t('today.trips')">
      <h2 class="text-subtitle-1 mb-2">{{ t('today.trips') }}</h2>
      <v-row v-if="groups.length > 0">
        <v-col v-for="[vehicleId, list] in groups" :key="vehicleId ?? 'none'" cols="12" md="6" xl="4">
          <v-card border flat data-testid="vehicle-card">
            <v-card-item :prepend-icon="vehicleId ? 'mdi-bus' : 'mdi-bus-alert'" :title="vehicleName(vehicleId)" />
            <v-table density="compact">
              <thead>
                <tr>
                  <th>{{ t('today.time') }}</th>
                  <th>{{ t('today.route') }}</th>
                  <th>{{ t('today.status') }}</th>
                  <th>{{ t('today.currentStop') }}</th>
                  <th>{{ t('today.delay') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inst in list" :key="inst.id">
                  <td class="tabular">{{ tripLabel(inst) }}</td>
                  <td>
                    <span v-if="inst.route" class="color-swatch mr-1" :style="{ background: `#${inst.route.color ?? '888888'}` }" />
                    {{ inst.route ? text(inst.route.name) : '—' }}
                  </td>
                  <td><v-chip size="small" :color="statusColor[inst.status]" variant="tonal">{{ t(`tripStatus.${inst.status}`) }}</v-chip></td>
                  <td>{{ stopName(inst.pattern_id, currentStopSequence(inst)) ?? '—' }}</td>
                  <td class="tabular">
                    <template v-if="delay(inst) !== null">{{ t('today.minutes', { n: delay(inst) }) }}</template>
                    <template v-else>—</template>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>
      <EmptyState
        v-else-if="!loading"
        icon="mdi-timer-sand"
        :title="t('today.noInstances')"
        :text="t('today.noInstancesText')"
      />

      <template v-if="plannedOnly.length > 0">
        <h3 class="text-subtitle-2 mt-6 mb-2">{{ t('today.plannedBySchedule') }}</h3>
        <v-table density="compact" class="border rounded" data-testid="planned-trips">
          <tbody>
            <tr v-for="trip in plannedOnly" :key="trip.id">
              <td class="tabular" style="width: 6rem">{{ formatTimeOfDay(trip.start_time) }}</td>
              <td>
                <span v-if="trip.route" class="color-swatch mr-1" :style="{ background: `#${trip.route.color ?? '888888'}` }" />
                {{ trip.route ? text(trip.route.name) : '' }} · {{ trip.pattern }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </section>
  </div>
</template>
