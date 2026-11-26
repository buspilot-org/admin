<script setup lang="ts">
// Which drivers drive a vehicle (driver_vehicle). Drivers then see only their
// vehicles' trips on Today (and trips any vehicle may run); the server
// filters, the console only manages the rows.
import type { Database } from '~/types/database.types'

const props = defineProps<{
  vehicle: { id: string, name: string } | null
  drivers: readonly string[]
  assigned: readonly string[]
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const op = useOperator()
const notify = useNotify()

const selected = ref<string[]>([])
const busy = ref(false)

watch(open, (isOpen) => {
  if (isOpen) selected.value = [...props.assigned]
}, { immediate: true })

const label = (userId: string) => staffLabel(userId, user.value?.sub ?? null, { you: t('drivers.you'), driver: t('drivers.driver') })

async function save() {
  const operatorId = op.currentId.value
  if (!props.vehicle || !operatorId) return
  const vehicleId = props.vehicle.id
  const { add, remove } = diffIds(props.assigned, selected.value)
  busy.value = true
  const results = await Promise.all([
    add.length > 0
      ? supabase.from('driver_vehicle').insert(add.map(userId => ({ operator_id: operatorId, user_id: userId, vehicle_id: vehicleId })))
      : null,
    remove.length > 0
      ? supabase.from('driver_vehicle').delete().eq('operator_id', operatorId).eq('vehicle_id', vehicleId).in('user_id', remove)
      : null,
  ])
  busy.value = false
  const failed = results.find(r => r?.error)
  if (failed?.error) {
    notify.error(failed.error)
    emit('saved')
    return
  }
  notify.success(t('common.saved'))
  open.value = false
  emit('saved')
}
</script>

<template>
  <v-dialog v-model="open" max-width="480">
    <v-card :title="t('drivers.dialogTitle', { vehicle: vehicle?.name ?? '' })">
      <v-card-text>
        <p class="text-body-2 mb-3">{{ t('drivers.dialogText') }}</p>
        <template v-if="drivers.length > 0">
          <v-checkbox
            v-for="d in drivers"
            :key="d"
            v-model="selected"
            :value="d"
            :label="label(d)"
            density="compact"
            hide-details
            data-testid="driver-option"
          />
        </template>
        <v-alert v-else type="info" variant="tonal" density="compact">{{ t('drivers.none') }}</v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="drivers.length === 0" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
