<script setup lang="ts">
// Create or edit a live (one-off) trip: title, vehicle, optional route,
// planned stops in order with times, the audiences that see it (with or
// without the map) and how long riders see it. Drivers create trips for
// their own vehicles; the server checks that (staff_trip_access).
//
// The trip is inserted first, then its planned stops and audiences (the
// server has no single call for this). If a later step fails, the dialog
// stays open on the saved trip, so saving again finishes the job.
import type { Database } from '~/types/database.types'
import type { PlannedStop, StopTimeError } from '~/utils/liveTrip'

type T = Database['public']['Tables']
export type LiveTripRow = Pick<T['trip_instance']['Row'], 'id' | 'service_date' | 'title' | 'vehicle_id' | 'route_id' | 'visible_until' | 'status'>

const props = defineProps<{
  trip: LiveTripRow | null
  vehicles: readonly { id: string, name: string }[]
  routes: readonly { id: string, name: unknown, visibility: string | null }[]
  stops: readonly { id: string, name: unknown }[]
  /** Null when the user may not read audiences (drivers). */
  audiences: readonly { id: string, name: unknown }[] | null
  /** Drivers must pick one of these vehicles; null for editors. */
  ownVehicleIds: readonly string[] | null
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const text = useText()
const notify = useNotify()

interface StopForm { key: number, origin: number | null, stopId: string | null, arrival: string, departure: string, locked: boolean }
interface AudienceForm { on: boolean, map: boolean }

const tripId = ref<string | null>(null)
const serviceDate = ref('')
const title = ref<I18nText>({})
const vehicleId = ref<string | null>(null)
const routeId = ref<string | null>(null)
const visibleUntil = ref('')
const stopRows = ref<StopForm[]>([])
const audienceForm = ref<Record<string, AudienceForm>>({})
const savedStops = shallowRef<PlannedStop[]>([])
const savedAudiences = shallowRef<{ audience_id: string, can_see_map: boolean }[]>([])
const loadingPlan = ref(false)
const busy = ref(false)
let nextKey = 0

const isDriver = computed(() => props.ownVehicleIds !== null)
// Set when the dialog opens (the page may stay open past midnight).
const today = ref('')
const VISIBLE_AFTER_LAST_STOP_MS = 2 * 60 * 60 * 1000
const tz = computed(() => op.timezone.value)

function emptyAudiences(): Record<string, AudienceForm> {
  return Object.fromEntries((props.audiences ?? []).map(a => [a.id, { on: false, map: false }]))
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  const tr = props.trip
  today.value = dateInTimeZone(new Date(), tz.value)
  tripId.value = tr?.id ?? null
  serviceDate.value = tr?.service_date ?? today.value
  title.value = i18nFormValue(tr?.title, op.languages.value)
  vehicleId.value = tr ? tr.vehicle_id : (props.ownVehicleIds?.length === 1 ? props.ownVehicleIds[0]! : null)
  routeId.value = tr?.route_id ?? null
  // New trips: empty = until a while after the last stop (see save).
  visibleUntil.value = tr ? toLocalInput(tr.visible_until, tz.value) : ''
  stopRows.value = []
  audienceForm.value = emptyAudiences()
  savedStops.value = []
  savedAudiences.value = []
  if (tr) await loadPlan(tr.id)
  else stopRows.value = [newRow(), newRow()]
}, { immediate: true })

// Audiences can arrive or change after the form was filled (the page
// reloads); every listed audience needs a form entry.
watch(() => props.audiences, (list) => {
  for (const a of list ?? []) audienceForm.value[a.id] ??= { on: false, map: false }
}, { immediate: true })

function newRow(): StopForm {
  return { key: nextKey++, origin: null, stopId: null, arrival: '', departure: '', locked: false }
}

/**
 * Saved planned stops, their progress and audiences of a trip. With
 * `fillForm`, the form shows them; otherwise (after a failed save) the form
 * keeps what was typed and the next save compares with the saved state.
 */
async function loadPlan(id: string, fillForm = true) {
  loadingPlan.value = true
  const [st, ev, au] = await Promise.all([
    supabase.from('trip_instance_stop').select('stop_sequence, stop_id, planned_arrival, planned_departure').eq('trip_instance_id', id).order('stop_sequence'),
    supabase.from('stop_event').select('stop_sequence, state').eq('trip_instance_id', id),
    props.audiences ? supabase.from('trip_instance_audience').select('audience_id, can_see_map').eq('trip_instance_id', id) : null,
  ])
  loadingPlan.value = false
  const failed = [st, ev, au].find(r => r?.error)
  if (failed?.error) return notify.error(failed.error)
  savedStops.value = st.data ?? []
  savedAudiences.value = au?.data ?? []
  if (!fillForm) return
  const reached = new Set((ev.data ?? []).filter(e => e.state !== 'upcoming' && e.state !== 'approaching').map(e => e.stop_sequence))
  stopRows.value = savedStops.value.map(s => ({
    key: nextKey++,
    origin: s.stop_sequence,
    stopId: s.stop_id,
    arrival: plannedInput(s.planned_arrival, serviceDate.value, tz.value),
    departure: plannedInput(s.planned_departure, serviceDate.value, tz.value),
    locked: reached.has(s.stop_sequence),
  }))
  const form = emptyAudiences()
  for (const a of savedAudiences.value) form[a.audience_id] = { on: true, map: a.can_see_map }
  audienceForm.value = form
}

// Choices
const vehicleItems = computed(() => {
  const list = isDriver.value ? props.vehicles.filter(v => props.ownVehicleIds!.includes(v.id)) : props.vehicles
  return [
    ...(isDriver.value ? [] : [{ value: null, title: t('live.noVehicle') }]),
    ...list.map(v => ({ value: v.id, title: v.name })),
  ]
})
const routeItems = computed(() => [
  { value: null, title: t('live.noRoute') },
  ...props.routes.map(r => ({ value: r.id, title: text(r.name) })),
])
const stopItems = computed(() => props.stops.map(s => ({ value: s.id, title: text(s.name) })))
const routeVisibility = computed(() => {
  if (!routeId.value) return null
  const r = props.routes.find(x => x.id === routeId.value)
  return r ? (r.visibility ?? op.operator.value?.default_visibility ?? 'invited_eta') : null
})
const mapCapped = computed(() => routeVisibility.value === 'invited_eta')

// Planned stops
function moveRow(index: number, delta: number) {
  const rows = [...stopRows.value]
  const target = index + delta
  if (target < 0 || target >= rows.length) return
  ;[rows[index], rows[target]] = [rows[target]!, rows[index]!]
  stopRows.value = rows
}
function removeRow(index: number) {
  stopRows.value = stopRows.value.filter((_, i) => i !== index)
}

const plannedRows = computed(() => stopRows.value.map((r) => {
  const arrival = plannedInstant(r.arrival, serviceDate.value, tz.value)
  const departure = plannedInstant(r.departure, serviceDate.value, tz.value)
  return {
    origin: r.origin,
    stop_id: r.stopId ?? '',
    planned_arrival: arrival ?? null,
    planned_departure: departure ?? null,
    invalid: arrival === undefined || departure === undefined,
  }
}))
const timeErrors = computed<(StopTimeError | null)[]>(() => stopTimeErrors(plannedRows.value))

// Visible until, read in the operator's time zone. Empty: two hours after
// the last planned time, or the end of the service day without times. Riders
// see nothing after it, so it must not end before the first stop.
const plannedTimes = computed(() => plannedRows.value.flatMap(r => [r.planned_arrival, r.planned_departure]).filter((x): x is string => !!x).sort())
const visibleUntilIso = computed(() => {
  if (visibleUntil.value) return fromLocalInput(visibleUntil.value, tz.value)
  const last = plannedTimes.value.at(-1)
  if (last) return new Date(new Date(last).getTime() + VISIBLE_AFTER_LAST_STOP_MS).toISOString()
  return serviceDate.value ? zonedInstant(addDays(serviceDate.value, 1), 0, tz.value).toISOString() : null
})
// Riders must see the trip until its last stop.
const visibleUntilError = computed(() => {
  const last = plannedTimes.value.at(-1) ?? (serviceDate.value ? zonedInstant(serviceDate.value, 0, tz.value).toISOString() : null)
  return visibleUntil.value && visibleUntilIso.value && last && visibleUntilIso.value <= last ? t('live.errors.visible_until_too_early') : null
})

const valid = computed(() =>
  !!cleanI18nText(title.value)
  && !!serviceDate.value
  && (!isDriver.value || !!vehicleId.value)
  && stopRows.value.length > 0
  && stopRows.value.every(r => !!r.stopId)
  && timeErrors.value.every(e => e === null)
  && !visibleUntilError.value
  && (!!tripId.value || serviceDate.value >= today.value),
)

async function save() {
  const operatorId = op.currentId.value
  if (!valid.value || !operatorId) return
  busy.value = true
  try {
    const values = {
      title: cleanI18nText(title.value)!,
      vehicle_id: vehicleId.value,
      route_id: routeId.value,
      visible_until: visibleUntilIso.value,
    }
    if (!tripId.value) {
      // The id is made here: reading the new row back in the same request
      // (INSERT … RETURNING) fails the select policy, whose
      // trip_instance_access(id) does not see the row yet (server follow-up).
      const id = crypto.randomUUID()
      const { error } = await supabase
        .from('trip_instance')
        .insert({ ...values, id, operator_id: operatorId, service_date: serviceDate.value, kind: 'live', started_by: 'driver' })
      if (error) throw error
      tripId.value = id
    }
    else {
      const { error } = await supabase.from('trip_instance').update(values).eq('id', tripId.value)
      if (error) throw error
    }
    const id = tripId.value

    const changes = planStopChanges(savedStops.value, plannedRows.value)
    if (changes.remove.length > 0) {
      const { error } = await supabase.from('trip_instance_stop').delete().eq('trip_instance_id', id).in('stop_sequence', changes.remove)
      if (error) throw error
    }
    for (const u of changes.update) {
      const { error } = await supabase
        .from('trip_instance_stop')
        .update({ planned_arrival: u.planned_arrival, planned_departure: u.planned_departure })
        .eq('trip_instance_id', id)
        .eq('stop_sequence', u.stop_sequence)
      if (error) throw error
    }
    if (changes.insert.length > 0) {
      const { error } = await supabase
        .from('trip_instance_stop')
        .insert(changes.insert.map(s => ({ ...s, operator_id: operatorId, trip_instance_id: id })))
      if (error) throw error
    }

    if (props.audiences) {
      const chosen = Object.entries(audienceForm.value).filter(([, a]) => a.on)
      const { remove } = diffIds(savedAudiences.value.map(a => a.audience_id), chosen.map(([audienceId]) => audienceId))
      if (remove.length > 0) {
        const { error } = await supabase.from('trip_instance_audience').delete().eq('trip_instance_id', id).in('audience_id', remove)
        if (error) throw error
      }
      if (chosen.length > 0) {
        const { error } = await supabase.from('trip_instance_audience').upsert(
          chosen.map(([audienceId, a]) => ({
            operator_id: operatorId,
            trip_instance_id: id,
            audience_id: audienceId,
            can_see_map: effectiveMapPermission(a.map, routeVisibility.value),
          })),
          { onConflict: 'trip_instance_id,audience_id' },
        )
        if (error) throw error
      }
    }
  }
  catch (err) {
    notify.error(err)
    // Compare with what is saved now, so saving again continues from there.
    if (tripId.value) await loadPlan(tripId.value, false)
    emit('saved')
    return
  }
  finally {
    busy.value = false
  }
  notify.success(t('common.saved'))
  open.value = false
  emit('saved')
}

const timeErrorText = (e: StopTimeError | null | undefined) => (e ? t(`live.errors.${e}`) : '')
</script>

<template>
  <v-dialog v-model="open" max-width="860" scrollable>
    <v-card :title="tripId ? t('live.edit') : t('live.new')" data-testid="live-trip-dialog">
      <v-card-text>
        <I18nTextField v-model="title" :languages="op.languages.value" :label="t('live.tripTitle')" :hint="t('live.tripTitleHint')" required />
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="serviceDate"
              type="date"
              :min="tripId ? undefined : today"
              :label="t('live.date')"
              :disabled="!!tripId"
              :error-messages="!tripId && serviceDate && serviceDate < today ? [t('live.errors.date_past')] : []"
              data-testid="live-date"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select v-model="vehicleId" :items="vehicleItems" :label="t('live.vehicle')" :hint="isDriver ? t('live.ownVehicleHint') : ''" persistent-hint data-testid="live-vehicle" />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select v-model="routeId" :items="routeItems" :label="t('live.route')" :hint="t('live.routeHint')" persistent-hint data-testid="live-route" />
          </v-col>
        </v-row>

        <h3 class="text-subtitle-1 mt-4 mb-1">{{ t('live.stops') }}</h3>
        <p class="text-caption text-medium-emphasis mb-2">{{ t('live.stopsHint') }}</p>
        <v-progress-linear v-if="loadingPlan" indeterminate class="mb-2" />
        <div
          v-for="(row, index) in stopRows"
          :key="row.key"
          class="d-flex flex-wrap align-start ga-2 mb-2"
          data-testid="live-stop-row"
        >
          <span class="text-body-2 tabular pt-2" style="width: 1.5rem">{{ index + 1 }}.</span>
          <v-autocomplete
            v-model="row.stopId"
            :items="stopItems"
            :label="t('live.stop')"
            :disabled="row.locked"
            hide-details="auto"
            style="min-width: 220px; flex: 2 1 220px"
            data-testid="live-stop"
          />
          <v-text-field
            v-model="row.arrival"
            :label="t('live.arrival')"
            placeholder="10:30"
            :disabled="row.locked"
            hide-details="auto"
            style="max-width: 110px"
            data-testid="live-arrival"
          />
          <v-text-field
            v-model="row.departure"
            :label="t('live.departure')"
            placeholder="10:45"
            :disabled="row.locked"
            :error-messages="timeErrors[index] ? [timeErrorText(timeErrors[index])] : []"
            hide-details="auto"
            style="max-width: 160px"
            data-testid="live-departure"
          />
          <div class="d-flex">
            <v-btn size="small" variant="text" icon="mdi-arrow-up" :aria-label="t('live.moveUp')" :disabled="index === 0 || row.locked || stopRows[index - 1]?.locked" @click="moveRow(index, -1)" />
            <v-btn size="small" variant="text" icon="mdi-arrow-down" :aria-label="t('live.moveDown')" :disabled="index === stopRows.length - 1 || row.locked" @click="moveRow(index, 1)" />
            <v-btn size="small" variant="text" icon="mdi-close" :aria-label="t('common.delete')" :disabled="row.locked" @click="removeRow(index)" />
          </div>
          <span v-if="row.locked" class="text-caption text-medium-emphasis w-100 ml-8">{{ t('live.reached') }}</span>
        </div>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" data-testid="live-add-stop" @click="stopRows.push(newRow())">{{ t('live.addStop') }}</v-btn>
        <p class="text-caption text-medium-emphasis mt-2">{{ t('live.newStopsLater') }}</p>

        <h3 class="text-subtitle-1 mt-4 mb-1">{{ t('live.audiences') }}</h3>
        <template v-if="audiences">
          <p class="text-caption text-medium-emphasis mb-2">{{ routeId ? t('live.audiencesWithRoute') : t('live.audiencesHint') }}</p>
          <v-alert v-if="mapCapped" type="info" variant="tonal" density="compact" class="mb-2">{{ t('live.mapCapped') }}</v-alert>
          <div v-for="a in audiences.filter(x => audienceForm[x.id])" :key="a.id" class="d-flex flex-wrap align-center ga-4" data-testid="live-audience">
            <v-checkbox v-model="audienceForm[a.id]!.on" :label="text(a.name)" density="compact" hide-details style="min-width: 220px" />
            <v-switch
              :model-value="audienceForm[a.id]!.map && !mapCapped"
              :label="t('live.canSeeMap')"
              :disabled="!audienceForm[a.id]!.on || mapCapped"
              color="primary"
              density="compact"
              hide-details
              @update:model-value="v => (audienceForm[a.id]!.map = !!v)"
            />
          </div>
          <p v-if="audiences.length === 0" class="text-body-2 text-medium-emphasis">{{ t('live.noAudiences') }}</p>
        </template>
        <v-alert v-else type="info" variant="tonal" density="compact">{{ t('live.driverAudiences') }}</v-alert>

        <v-text-field
          v-model="visibleUntil"
          type="datetime-local"
          :label="t('live.visibleUntil')"
          :hint="t('live.visibleUntilHint')"
          :placeholder="visibleUntil ? undefined : t('live.visibleUntilAuto')"
          :error-messages="visibleUntilError ? [visibleUntilError] : []"
          persistent-hint
          persistent-placeholder
          clearable
          class="mt-4"
          style="max-width: 320px"
          data-testid="live-visible-until"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" data-testid="live-save" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
