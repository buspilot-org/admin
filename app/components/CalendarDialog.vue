<script setup lang="ts">
// Create or edit a service calendar: weekdays, validity, national holidays.
import type { Database } from '~/types/database.types'
import type { CalendarRow } from '~/composables/useScheduleData'
import type { NationalHoliday } from '~/composables/useNationalHolidays'

const props = defineProps<{ calendar: CalendarRow | null, holidays: readonly NationalHoliday[] }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const notify = useNotify()
const text = useText()

const name = ref('')
const weekdays = ref<number[]>([0, 1, 2, 3, 4])
const startDate = ref('')
const endDate = ref('')
const skipHolidays = ref(true)
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  const c = props.calendar
  name.value = c?.name ?? ''
  weekdays.value = c ? weekdaysToIndexes(c.weekdays) : [0, 1, 2, 3, 4]
  startDate.value = c?.start_date ?? ''
  endDate.value = c?.end_date ?? ''
  skipHolidays.value = c?.skip_national_holidays ?? true
}, { immediate: true })

// National holidays on the chosen weekdays in the validity range (exceptions
// of the saved calendar decide their own dates).
const affectedHolidays = computed(() => {
  if (!startDate.value || !endDate.value || endDate.value < startDate.value) return []
  return holidaysInService(
    { weekdays: indexesToWeekdays(weekdays.value), start_date: startDate.value, end_date: endDate.value },
    props.calendar?.calendar_exception ?? [],
    props.holidays,
  )
})

const valid = computed(() => !!name.value.trim() && !!startDate.value && !!endDate.value && endDate.value >= startDate.value)

async function save() {
  if (!valid.value || !op.currentId.value) return
  busy.value = true
  const values = {
    name: name.value.trim(),
    weekdays: indexesToWeekdays(weekdays.value),
    start_date: startDate.value,
    end_date: endDate.value,
    skip_national_holidays: skipHolidays.value,
  }
  const { error } = props.calendar
    ? await supabase.from('service_calendar').update(values).eq('id', props.calendar.id)
    : await supabase.from('service_calendar').insert({ ...values, operator_id: op.currentId.value })
  busy.value = false
  if (error) return notify.error(error)
  notify.success(t('common.saved'))
  open.value = false
  emit('saved')
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card :title="calendar ? t('schedule.calendars.edit') : t('schedule.calendars.new')">
      <v-card-text>
        <v-text-field v-model="name" :label="t('schedule.calendars.name')" />
        <div class="text-body-2 mb-1">{{ t('schedule.calendars.weekdays') }}</div>
        <v-btn-toggle v-model="weekdays" multiple divided variant="outlined" density="comfortable" class="mb-4">
          <v-btn v-for="i in 7" :key="i" :value="i - 1">{{ t(`weekday.short.${i - 1}`) }}</v-btn>
        </v-btn-toggle>
        <div class="d-flex ga-3">
          <v-text-field v-model="startDate" type="date" :label="t('schedule.calendars.from')" />
          <v-text-field v-model="endDate" type="date" :label="t('schedule.calendars.to')" :error-messages="endDate && startDate && endDate < startDate ? [t('schedule.calendars.endBeforeStart')] : []" />
        </div>
        <v-switch v-model="skipHolidays" color="primary" :label="t('schedule.calendars.skipHolidays')" hide-details />
        <div v-if="affectedHolidays.length > 0" class="mt-2" data-testid="dialog-holidays">
          <div class="text-body-2 mb-1">
            {{ skipHolidays ? t('schedule.calendars.holidaysSkipped', { n: affectedHolidays.length }) : t('schedule.calendars.holidaysServed', { n: affectedHolidays.length }) }}
          </div>
          <div class="d-flex flex-wrap ga-1">
            <v-chip v-for="h in affectedHolidays" :key="h.date" size="small" variant="tonal" :color="skipHolidays ? 'error' : 'success'" class="tabular">
              {{ h.date }} {{ text(h.name) }}
            </v-chip>
          </div>
        </div>
        <div v-else-if="startDate && endDate" class="text-caption text-medium-emphasis mt-2">{{ t('schedule.calendars.noHolidaysInRange') }}</div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
