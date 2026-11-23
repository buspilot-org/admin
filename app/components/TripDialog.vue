<script setup lang="ts">
// Add, edit or copy a trip ("copy with another start time" = a new trip of
// the same pattern).
import type { Database } from '~/types/database.types'
import type { CalendarRow, TripRow } from '~/composables/useScheduleData'

const props = defineProps<{
  mode: 'new' | 'edit' | 'copy'
  patternId: string | null
  trip: TripRow | null
  calendars: CalendarRow[]
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const notify = useNotify()

const startTime = ref('')
const calendarId = ref<string | null>(null)
const headsign = ref<I18nText>({})
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  startTime.value = props.trip && props.mode === 'edit' ? formatTimeOfDay(props.trip.start_time) : ''
  calendarId.value = props.trip?.service_calendar_id ?? props.calendars[0]?.id ?? null
  headsign.value = i18nFormValue(props.trip?.headsign, op.languages.value)
}, { immediate: true })

const seconds = computed(() => parseTimeOfDay(startTime.value))
const valid = computed(() => seconds.value !== null && !!calendarId.value && !!props.patternId)
const title = computed(() => t(`schedule.trip.${props.mode}`))

async function save() {
  if (!valid.value || !op.currentId.value) return
  busy.value = true
  const values = {
    start_time: seconds.value!,
    service_calendar_id: calendarId.value!,
    headsign: cleanI18nText(headsign.value),
  }
  const { error } = props.mode === 'edit' && props.trip
    ? await supabase.from('trip').update(values).eq('id', props.trip.id)
    : await supabase.from('trip').insert({ ...values, operator_id: op.currentId.value, pattern_id: props.patternId! })
  busy.value = false
  if (error) return notify.error(error)
  notify.success(t('common.saved'))
  open.value = false
  emit('saved')
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card :title="title">
      <v-card-text>
        <p v-if="mode === 'copy' && trip" class="text-body-2 mb-4">
          {{ t('schedule.trip.copyHint', { time: formatTimeOfDay(trip.start_time) }) }}
        </p>
        <v-text-field
          v-model="startTime"
          :label="t('schedule.startTime')"
          placeholder="07:30"
          :error-messages="startTime && seconds === null ? [t('schedule.invalidTime')] : []"
          autofocus
          data-testid="trip-start-time"
        />
        <v-select
          v-model="calendarId"
          :items="calendars"
          item-title="name"
          item-value="id"
          :label="t('schedule.calendar')"
        />
        <I18nTextField v-model="headsign" :languages="op.languages.value" :label="t('schedule.headsign')" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
