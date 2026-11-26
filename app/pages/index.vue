<script setup lang="ts">
// Today: trip instances per vehicle with status, current stop and delay,
// warnings that need someone, and today's live (one-off) trips. Live state is
// written by the engine; until it runs, the page shows what the schedule
// says. Drivers see only their vehicles' trips (and trips any vehicle may
// run): the server filters trip instances; the schedule fallback follows the
// same rule with the driver's own driver_vehicle rows.
import type { Database } from '~/types/database.types'
import type { InstanceLike, Warning } from '~/utils/today'
import type { PlannedStop } from '~/utils/liveTrip'
import type { LiveTripRow } from '~/components/LiveTripDialog.vue'

type T = Database['public']['Tables']
type InstanceRow = T['trip_instance']['Row'] & {
  trip: Pick<T['trip']['Row'], 'start_time' | 'headsign'> | null
  route: Pick<T['route']['Row'], 'name' | 'short_name' | 'color' | 'text_color'> | null
  stop_events: InstanceLike['stop_events']
}
type PatternStopRow = Pick<T['pattern_stop']['Row'], 'pattern_id' | 'stop_sequence' | 'arrival_offset'> & {
  stop: { name: unknown } | null
}
type PlannedStopRow = PlannedStop & { trip_instance_id: string }

// A plain string keeps the type checker from expanding the nested select.
const INSTANCE_SELECT: string = '*, trip(start_time, headsign), route(name, short_name, color, text_color), stop_events:stop_event(stop_sequence, state, eta)'

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const config = useRuntimeConfig()
const user = useSupabaseUser()
const op = useOperator()
const text = useText()
const notify = useNotify()
const { loadSchedule, calendarsRunningOn } = useScheduleData()
const { loadHolidays, holidayOn } = useNationalHolidays()

const today = ref('')
const now = ref(new Date())
const instances = shallowRef<InstanceRow[]>([])
// Live trips planned for later days (tours planned ahead), listed with today's.
const upcomingLive = shallowRef<InstanceRow[]>([])
const vehicles = shallowRef<Pick<T['vehicle']['Row'], 'id' | 'name' | 'active'>[]>([])
const states = shallowRef<Pick<T['vehicle_state']['Row'], 'vehicle_id' | 'recorded_at' | 'speed_kmh'>[]>([])
const patternStops = shallowRef<PatternStopRow[]>([])
const plannedStops = shallowRef<PlannedStopRow[]>([])
const plannedOnly = shallowRef<{ id: string, start_time: number, pattern: string, route: PatternRowRoute | null }[]>([])
type PatternRowRoute = { name: unknown, short_name: string | null, color: string | null, text_color: string | null }
const routes = shallowRef<{ id: string, name: unknown, visibility: string | null }[]>([])
const stops = shallowRef<{ id: string, name: unknown }[]>([])
const audiences = shallowRef<{ id: string, name: unknown }[] | null>(null)
const ownVehicleIds = shallowRef<string[] | null>(null)

const isDriver = computed(() => op.role.value === 'driver')
const UPCOMING_DAYS = 60

const { loading, error, reload } = useOperatorLoader(async (operatorId, isStale) => {
  now.value = new Date()
  today.value = dateInTimeZone(now.value, op.timezone.value)
  const yesterday = addDays(today.value, -1)
  const driver = isDriver.value
  const [inst, upc, veh, st, schedule, running, rt, sp, au, dv] = await Promise.all([
    supabase
      .from('trip_instance')
      .select(INSTANCE_SELECT)
      .eq('operator_id', operatorId)
      // Trips past midnight belong to yesterday's service date; keep those
      // still running.
      .or(`service_date.eq.${today.value},and(service_date.eq.${yesterday},status.eq.active)`),
    supabase
      .from('trip_instance')
      .select(INSTANCE_SELECT)
      .eq('operator_id', operatorId)
      .eq('kind', 'live')
      .gt('service_date', today.value)
      .lte('service_date', addDays(today.value, UPCOMING_DAYS))
      .in('status', ['planned', 'active'])
      .order('service_date'),
    supabase.from('vehicle').select('id, name, active').eq('operator_id', operatorId).order('name'),
    supabase.from('vehicle_state').select('vehicle_id, recorded_at, speed_kmh').eq('operator_id', operatorId),
    loadSchedule(operatorId),
    calendarsRunningOn(operatorId, today.value),
    supabase.from('route').select('id, name, visibility').eq('operator_id', operatorId).order('sort_order'),
    supabase.from('stop').select('id, name').eq('operator_id', operatorId),
    // Drivers may not read audiences (RLS), so they cannot choose them.
    driver ? null : supabase.from('audience').select('id, name').eq('operator_id', operatorId).order('created_at'),
    driver && user.value?.sub
      ? supabase.from('driver_vehicle').select('vehicle_id').eq('operator_id', operatorId).eq('user_id', user.value.sub)
      : null,
    loadHolidays(),
  ])
  if (isStale()) return
  for (const res of [inst, upc, veh, st, rt, sp, au, dv]) if (res?.error) throw res.error
  // Yesterday's trips that still run come first, then by start time.
  instances.value = (inst.data as unknown as InstanceRow[]).sort(
    (a, b) => a.service_date.localeCompare(b.service_date) || (a.trip?.start_time ?? 0) - (b.trip?.start_time ?? 0),
  )
  upcomingLive.value = upc.data as unknown as InstanceRow[]
  vehicles.value = veh.data ?? []
  states.value = st.data ?? []
  routes.value = rt.data ?? []
  stops.value = [...(sp.data ?? [])].sort((a, b) => text(a.name).localeCompare(text(b.name)))
  audiences.value = au ? au.data ?? [] : null
  ownVehicleIds.value = driver ? (dv?.data ?? []).map(x => x.vehicle_id) : null

  const patternIds = [...new Set(instances.value.map(i => i.pattern_id).filter((id): id is string => !!id))]
  const liveIds = [...instances.value.filter(i => i.kind === 'live'), ...upcomingLive.value].map(i => i.id)
  const [ps, ls] = await Promise.all([
    patternIds.length > 0
      ? supabase.from('pattern_stop').select('pattern_id, stop_sequence, arrival_offset, stop(name)').in('pattern_id', patternIds)
      : null,
    liveIds.length > 0
      ? supabase.from('trip_instance_stop').select('trip_instance_id, stop_sequence, stop_id, planned_arrival, planned_departure').in('trip_instance_id', liveIds).order('stop_sequence')
      : null,
  ])
  if (isStale()) return
  if (ps?.error) throw ps.error
  if (ls?.error) throw ls.error
  patternStops.value = (ps?.data as unknown as PatternStopRow[] | undefined) ?? []
  plannedStops.value = ls?.data ?? []

  // Scheduled trips the engine has not created an instance for (yet). The
  // server says which calendars run today (national holidays included).
  const created = new Set(instances.value.filter(i => i.service_date === today.value).map(i => i.trip_id))
  const own = ownVehicleIds.value
  const patternById = new Map(schedule.patterns.map(p => [p.id, p]))
  plannedOnly.value = tripsOnDate(schedule.trips, running)
    .filter(trip => !created.has(trip.id))
    .filter(trip => !own || !trip.vehicle_id || own.includes(trip.vehicle_id))
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
  timer = setInterval(() => {
    if (!liveDialog.value && !cancelOpen.value) reload()
  }, 30_000)
})
onBeforeUnmount(() => clearInterval(timer))

const holiday = computed(() => (today.value ? holidayOn(today.value) : null))
const vehicleName = (id: string | null) => (id ? vehicles.value.find(v => v.id === id)?.name ?? '—' : t('today.noVehicle'))

const viewInstances = computed(() => instances.value.map(i => ({ ...i, start_time: i.trip?.start_time ?? null })))
const warnings = computed<Warning[]>(() =>
  computeWarnings(viewInstances.value, states.value, now.value, Number(config.public.stalePositionSeconds)),
)
const groups = computed(() => [...groupByVehicle(viewInstances.value).entries()])
const liveTrips = computed(() => [...instances.value.filter(i => i.kind === 'live'), ...upcomingLive.value])
const stopNameById = computed(() => new Map(stops.value.map(s => [s.id, s.name])))
const plannedOf = (instanceId: string) => plannedStops.value.filter(p => p.trip_instance_id === instanceId)

function stopName(inst: InstanceRow, sequence: number | null) {
  if (sequence === null) return null
  if (inst.kind === 'live' && !inst.pattern_id) {
    const planned = plannedOf(inst.id)
    const index = planned.findIndex(p => p.stop_sequence === sequence)
    return index >= 0 ? `${index + 1}. ${text(stopNameById.value.get(planned[index]!.stop_id))}` : null
  }
  const ps = patternStops.value.find(p => p.pattern_id === inst.pattern_id && p.stop_sequence === sequence)
  return ps ? `${sequence}. ${text(ps.stop?.name)}` : `${sequence}.`
}

function delay(inst: (typeof viewInstances.value)[number]) {
  if (inst.status !== 'active') return null
  if (inst.kind === 'live' && !inst.pattern_id) return liveDelayMinutes(inst.stop_events, plannedOf(inst.id))
  if (!inst.pattern_id) return null
  const offsets = new Map(patternStops.value.filter(p => p.pattern_id === inst.pattern_id).map(p => [p.stop_sequence, p.arrival_offset]))
  return delayMinutes(inst, offsets, op.timezone.value)
}

function tripLabel(inst: InstanceRow) {
  if (inst.kind === 'live') return text(inst.title) || t('today.liveTrip')
  return inst.trip ? formatTimeOfDay(inst.trip.start_time) : '—'
}

/** First and last planned time of a live trip ("10:30–15:00"). */
function liveTimes(inst: InstanceRow) {
  const planned = plannedOf(inst.id)
  const first = planned[0]
  const last = planned[planned.length - 1]
  const from = first?.planned_arrival ?? first?.planned_departure
  const to = last?.planned_arrival ?? last?.planned_departure
  if (!from && !to) return '—'
  const fmt = (iso: string | null | undefined) => (iso ? plannedInput(iso, inst.service_date, op.timezone.value) : '')
  return `${fmt(from)}–${fmt(to)}`
}

const statusColor: Record<string, string> = { planned: 'default', active: 'primary', completed: 'success', cancelled: 'error' }

// Live trips
const canCreateLive = computed(() => !isDriver.value || (ownVehicleIds.value?.length ?? 0) > 0)
const liveDialog = ref(false)
const liveSelected = ref<LiveTripRow | null>(null)
function openLive(inst: InstanceRow | null) {
  liveSelected.value = inst
  liveDialog.value = true
}
const cancelling = ref<InstanceRow | null>(null)
const cancelOpen = computed({ get: () => !!cancelling.value, set: (v) => { if (!v) cancelling.value = null } })
const busy = ref(false)
async function cancelLive() {
  if (!cancelling.value) return
  busy.value = true
  const { error: err } = await supabase.from('trip_instance').update({ status: 'cancelled' }).eq('id', cancelling.value.id)
  busy.value = false
  if (err) return notify.error(err)
  cancelling.value = null
  notify.success(t('live.cancelled'))
  await reload()
}
</script>

<template>
  <div>
    <PageHeader :title="t('today.title')" :subtitle="today ? t('today.date', { date: today }) : ''">
      <v-btn variant="text" prepend-icon="mdi-refresh" :loading="loading" @click="reload">{{ t('common.refresh') }}</v-btn>
      <v-btn v-if="canCreateLive" color="primary" prepend-icon="mdi-map-marker-path" data-testid="new-live-trip" @click="openLive(null)">{{ t('live.new') }}</v-btn>
    </PageHeader>

    <v-alert v-if="holiday" type="info" variant="tonal" density="compact" icon="mdi-flag-variant" class="mb-4" data-testid="today-holiday">
      {{ t('today.holiday', { name: text(holiday.name) }) }}
    </v-alert>

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

    <section v-if="liveTrips.length > 0" class="mb-6" :aria-label="t('live.title')">
      <h2 class="text-subtitle-1 mb-2">{{ t('live.title') }}</h2>
      <v-card border flat>
        <v-table density="compact" data-testid="live-trips">
          <thead>
            <tr>
              <th>{{ t('live.tripTitle') }}</th>
              <th>{{ t('live.date') }}</th>
              <th>{{ t('live.vehicle') }}</th>
              <th>{{ t('live.times') }}</th>
              <th>{{ t('live.stops') }}</th>
              <th>{{ t('live.visibleUntil') }}</th>
              <th>{{ t('today.status') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="inst in liveTrips" :key="inst.id">
              <td>
                {{ tripLabel(inst) }}
                <div v-if="inst.route" class="text-caption text-medium-emphasis">
                  <span class="color-swatch mr-1" :style="{ background: `#${inst.route.color ?? '888888'}` }" />{{ text(inst.route.name) }}
                </div>
              </td>
              <td class="tabular">{{ inst.service_date === today ? t('live.today') : inst.service_date }}</td>
              <td>{{ vehicleName(inst.vehicle_id) }}</td>
              <td class="tabular">{{ liveTimes(inst) }}</td>
              <td class="tabular">{{ plannedOf(inst.id).length }}</td>
              <td class="tabular">{{ inst.visible_until ? `${dateInTimeZone(new Date(inst.visible_until), op.timezone.value)} ${formatClock(inst.visible_until, op.timezone.value)}` : '—' }}</td>
              <td><v-chip size="small" :color="statusColor[inst.status]" variant="tonal">{{ t(`tripStatus.${inst.status}`) }}</v-chip></td>
              <td class="text-right text-no-wrap">
                <template v-if="inst.status === 'planned' || inst.status === 'active'">
                  <v-btn size="small" variant="text" icon="mdi-pencil" :aria-label="t('common.edit')" data-testid="edit-live-trip" @click="openLive(inst)" />
                  <v-btn size="small" variant="text" color="error" icon="mdi-cancel" :aria-label="t('live.cancel')" :title="t('live.cancel')" @click="cancelling = inst" />
                </template>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
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
                  <td>{{ stopName(inst, currentStopSequence(inst)) ?? '—' }}</td>
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

    <LiveTripDialog
      v-model="liveDialog"
      :trip="liveSelected"
      :vehicles="vehicles"
      :routes="routes"
      :stops="stops"
      :audiences="audiences"
      :own-vehicle-ids="ownVehicleIds"
      @saved="reload"
    />
    <ConfirmDialog
      v-model="cancelOpen"
      :title="t('live.cancelTitle')"
      :text="cancelling ? t('live.cancelText', { title: tripLabel(cancelling) }) : ''"
      :confirm-label="t('live.cancel')"
      :busy="busy"
      @confirm="cancelLive"
    />
  </div>
</template>
