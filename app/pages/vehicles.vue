<script setup lang="ts">
// Vehicles with their current state. The Traccar device ID decides whose bus
// a tracker's positions belong to, so only the Buspilot team sets it (column
// privilege in the schema); editors see it read-only.
import type { Database } from '~/types/database.types'

definePageMeta({ roles: ['owner', 'editor'] })

type T = Database['public']['Tables']
type VehicleRow = T['vehicle']['Row']
type StateRow = T['vehicle_state']['Row']

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const config = useRuntimeConfig()
const op = useOperator()
const notify = useNotify()

const vehicles = shallowRef<VehicleRow[]>([])
const states = shallowRef<StateRow[]>([])
const activeTrips = shallowRef<{ id: string, status: string }[]>([])
const now = ref(new Date())

const { loading, error, reload } = useOperatorLoader(async (operatorId) => {
  now.value = new Date()
  const [v, s] = await Promise.all([
    supabase.from('vehicle').select('*').eq('operator_id', operatorId).order('name'),
    supabase.from('vehicle_state').select('*').eq('operator_id', operatorId),
  ])
  if (v.error) throw v.error
  if (s.error) throw s.error
  vehicles.value = v.data
  states.value = s.data
  const tripIds = s.data.map(x => x.trip_instance_id).filter((id): id is string => !!id)
  if (tripIds.length > 0) {
    const ti = await supabase.from('trip_instance').select('id, status').in('id', tripIds)
    if (ti.error) throw ti.error
    activeTrips.value = ti.data
  }
  else {
    activeTrips.value = []
  }
})

function stateOf(v: VehicleRow) {
  const s = states.value.find(x => x.vehicle_id === v.id)
  if (!s) return { label: t('vehicles.state.noData'), color: 'default', detail: '' }
  const age = (now.value.getTime() - new Date(s.recorded_at).getTime()) / 1000
  const trip = activeTrips.value.find(x => x.id === s.trip_instance_id)
  const detail = t('vehicles.lastPosition', { time: formatClock(s.recorded_at, op.timezone.value), date: dateInTimeZone(new Date(s.recorded_at), op.timezone.value) })
  if (trip?.status === 'active') {
    return age > Number(config.public.stalePositionSeconds)
      ? { label: t('vehicles.state.stale'), color: 'warning', detail }
      : { label: t('vehicles.state.onTrip'), color: 'primary', detail }
  }
  return { label: t('vehicles.state.idle'), color: 'default', detail }
}

// Dialog
const dialog = ref(false)
const editing = ref<VehicleRow | null>(null)
const name = ref('')
const capacity = ref<string>('')
const active = ref(true)
const busy = ref(false)
function openDialog(v: VehicleRow | null) {
  editing.value = v
  name.value = v?.name ?? ''
  capacity.value = v?.capacity ? String(v.capacity) : ''
  active.value = v?.active ?? true
  dialog.value = true
}
const capacityValue = computed(() => (capacity.value.trim() === '' ? null : Number(capacity.value)))
const valid = computed(() => !!name.value.trim() && (capacityValue.value === null || (Number.isInteger(capacityValue.value) && capacityValue.value > 0)))

async function save() {
  if (!valid.value || !op.currentId.value) return
  busy.value = true
  // Only the columns editors may write: never traccar_device_id.
  const values = { name: name.value.trim(), capacity: capacityValue.value, active: active.value }
  const { error: err } = editing.value
    ? await supabase.from('vehicle').update(values).eq('id', editing.value.id)
    : await supabase.from('vehicle').insert({ ...values, operator_id: op.currentId.value })
  busy.value = false
  if (err) return notify.error(err)
  notify.success(t('common.saved'))
  dialog.value = false
  await reload()
}
</script>

<template>
  <div>
    <PageHeader :title="t('vehicles.title')">
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openDialog(null)">{{ t('vehicles.new') }}</v-btn>
    </PageHeader>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>

    <v-card v-if="vehicles.length > 0" border flat>
      <v-table data-testid="vehicles-table">
        <thead>
          <tr>
            <th>{{ t('vehicles.name') }}</th>
            <th>{{ t('vehicles.capacity') }}</th>
            <th>{{ t('vehicles.traccarId') }}</th>
            <th>{{ t('vehicles.stateLabel') }}</th>
            <th>{{ t('vehicles.active') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vehicles" :key="v.id">
            <td>{{ v.name }}</td>
            <td class="tabular">{{ v.capacity ?? '—' }}</td>
            <td class="tabular">
              <span v-if="v.traccar_device_id">{{ v.traccar_device_id }}</span>
              <span v-else class="text-medium-emphasis">{{ t('vehicles.noTracker') }}</span>
            </td>
            <td>
              <v-chip size="small" variant="tonal" :color="stateOf(v).color">{{ stateOf(v).label }}</v-chip>
              <div v-if="stateOf(v).detail" class="text-caption text-medium-emphasis">{{ stateOf(v).detail }}</div>
            </td>
            <td><v-icon :icon="v.active ? 'mdi-check' : 'mdi-minus'" :aria-label="v.active ? t('common.yes') : t('common.no')" /></td>
            <td class="text-right"><v-btn size="small" variant="text" icon="mdi-pencil" :aria-label="t('common.edit')" @click="openDialog(v)" /></td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
    <EmptyState v-else-if="!loading" icon="mdi-bus" :title="t('vehicles.empty')" />

    <v-dialog v-model="dialog" max-width="480">
      <v-card :title="editing ? t('vehicles.edit') : t('vehicles.new')">
        <v-card-text>
          <v-text-field v-model="name" :label="t('vehicles.name')" autofocus />
          <v-text-field v-model="capacity" type="number" min="1" :label="t('vehicles.capacity')" />
          <v-text-field
            :model-value="editing?.traccar_device_id ?? ''"
            :label="t('vehicles.traccarId')"
            :hint="t('vehicles.traccarHint')"
            persistent-hint
            readonly
            disabled
            data-testid="traccar-id"
          />
          <v-switch v-model="active" color="primary" :label="t('vehicles.active')" class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" @click="save">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
