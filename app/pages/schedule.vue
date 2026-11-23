<script setup lang="ts">
// Schedule: trips per pattern, calendars with exceptions as date ranges, and
// a preview "which trips run on date X".
import type { Database } from '~/types/database.types'
import type { CalendarRow, PatternRow, TripRow } from '~/composables/useScheduleData'

definePageMeta({ roles: ['owner', 'editor'] })

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const text = useText()
const notify = useNotify()
const { loadSchedule } = useScheduleData()

const tab = ref<'trips' | 'calendars' | 'preview'>('trips')
const patterns = shallowRef<PatternRow[]>([])
const trips = shallowRef<TripRow[]>([])
const calendars = shallowRef<CalendarRow[]>([])
const patternId = ref<string | null>(null)

interface ExceptionForm { start: string, end: string, type: 'removed' | 'added', reason: string }
const emptyException = (): ExceptionForm => ({ start: '', end: '', type: 'removed', reason: '' })
const exceptionForm = ref<Record<string, ExceptionForm>>({})

const { loading, error, reload } = useOperatorLoader(async (operatorId, isStale) => {
  const data = await loadSchedule(operatorId)
  if (isStale()) return
  patterns.value = data.patterns
  trips.value = data.trips
  calendars.value = data.calendars
  for (const c of data.calendars) exceptionForm.value[c.id] ??= emptyException()
  if (!patterns.value.some(p => p.id === patternId.value)) patternId.value = patterns.value[0]?.id ?? null
})

const patternItems = computed(() => patterns.value.map(p => ({
  value: p.id,
  title: `${p.route ? text(p.route.name) : ''} · ${p.name}`,
})))
const calendarName = (id: string) => calendars.value.find(c => c.id === id)?.name ?? '—'
const patternTrips = computed(() => trips.value.filter(tr => tr.pattern_id === patternId.value))

// Trip dialogs
const tripDialog = ref(false)
const tripMode = ref<'new' | 'edit' | 'copy'>('new')
const tripSelected = ref<TripRow | null>(null)
function openTrip(mode: 'new' | 'edit' | 'copy', trip: TripRow | null = null) {
  tripMode.value = mode
  tripSelected.value = trip
  tripDialog.value = true
}
const deleteTrip = ref<TripRow | null>(null)
const deleteOpen = computed({ get: () => !!deleteTrip.value, set: (v) => { if (!v) deleteTrip.value = null } })
const busy = ref(false)
async function confirmDeleteTrip() {
  if (!deleteTrip.value) return
  busy.value = true
  const { error: err } = await supabase.from('trip').delete().eq('id', deleteTrip.value.id)
  busy.value = false
  if (err) return notify.error(err)
  deleteTrip.value = null
  notify.success(t('common.deleted'))
  await reload()
}

// Calendars
const calendarDialog = ref(false)
const calendarSelected = ref<CalendarRow | null>(null)
function openCalendar(c: CalendarRow | null) {
  calendarSelected.value = c
  calendarDialog.value = true
}
const tripsUsing = (calendarId: string) => trips.value.filter(tr => tr.service_calendar_id === calendarId).length
async function deleteCalendar(c: CalendarRow) {
  const { error: err } = await supabase.from('service_calendar').delete().eq('id', c.id)
  if (err) return notify.error(err)
  notify.success(t('common.deleted'))
  await reload()
}

function formFor(calendarId: string) {
  return exceptionForm.value[calendarId] ?? emptyException()
}
async function addException(c: CalendarRow) {
  const f = formFor(c.id)
  const end = f.end || f.start
  if (!f.start || end < f.start || !op.currentId.value) return
  const { error: err } = await supabase.from('calendar_exception').insert({
    operator_id: op.currentId.value,
    calendar_id: c.id,
    start_date: f.start,
    end_date: end,
    type: f.type,
    reason: f.reason.trim() || null,
  })
  if (err) return notify.error(err)
  exceptionForm.value[c.id] = emptyException()
  await reload()
}
async function removeException(id: string) {
  const { error: err } = await supabase.from('calendar_exception').delete().eq('id', id)
  if (err) return notify.error(err)
  await reload()
}

// Preview
const previewDate = ref(dateInTimeZone(new Date(), op.timezone.value))
const previewTrips = computed(() => {
  if (!previewDate.value) return []
  const byId = new Map(patterns.value.map(p => [p.id, p]))
  return tripsOnDate(trips.value, calendars.value, previewDate.value)
    .map(tr => ({ trip: tr, pattern: byId.get(tr.pattern_id) ?? null }))
    .sort((a, b) => a.trip.start_time - b.trip.start_time)
})

const weekdayLabels = (mask: number) => weekdaysToIndexes(mask).map(i => t(`weekday.short.${i}`)).join(' ')
const rangeLabel = (start: string, end: string) => (start === end ? start : `${start} – ${end}`)
</script>

<template>
  <div>
    <PageHeader :title="t('schedule.title')" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="trips">{{ t('schedule.tabs.trips') }}</v-tab>
      <v-tab value="calendars">{{ t('schedule.tabs.calendars') }}</v-tab>
      <v-tab value="preview">{{ t('schedule.tabs.preview') }}</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="trips">
        <EmptyState v-if="!loading && patterns.length === 0" icon="mdi-timetable" :title="t('schedule.noPatterns')" :text="t('schedule.noPatternsText')" />
        <template v-else>
          <div class="d-flex flex-wrap ga-3 align-center mb-2">
            <v-select v-model="patternId" :items="patternItems" :label="t('schedule.pattern')" style="max-width: 480px" hide-details />
            <v-btn color="primary" prepend-icon="mdi-plus" :disabled="!patternId || calendars.length === 0" @click="openTrip('new')">{{ t('schedule.trip.new') }}</v-btn>
          </div>
          <v-alert v-if="calendars.length === 0" type="info" variant="tonal" density="compact" class="mb-2">{{ t('schedule.needCalendar') }}</v-alert>
          <v-card border flat>
            <v-table density="comfortable" data-testid="trips-table">
              <thead>
                <tr>
                  <th>{{ t('schedule.startTime') }}</th>
                  <th>{{ t('schedule.calendar') }}</th>
                  <th>{{ t('schedule.headsign') }}</th>
                  <th class="text-right">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tr in patternTrips" :key="tr.id">
                  <td class="tabular">{{ formatTimeOfDay(tr.start_time) }}</td>
                  <td>{{ calendarName(tr.service_calendar_id) }}</td>
                  <td>{{ text(tr.headsign) || '—' }}</td>
                  <td class="text-right text-no-wrap">
                    <v-btn size="small" variant="text" prepend-icon="mdi-content-copy" @click="openTrip('copy', tr)">{{ t('schedule.trip.copy') }}</v-btn>
                    <v-btn size="small" variant="text" icon="mdi-pencil" :aria-label="t('common.edit')" @click="openTrip('edit', tr)" />
                    <v-btn size="small" variant="text" icon="mdi-delete" :aria-label="t('common.delete')" @click="deleteTrip = tr" />
                  </td>
                </tr>
                <tr v-if="patternTrips.length === 0">
                  <td colspan="4" class="text-medium-emphasis">{{ t('schedule.noTrips') }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </template>
      </v-window-item>

      <v-window-item value="calendars">
        <div class="mb-3">
          <v-btn color="primary" prepend-icon="mdi-plus" @click="openCalendar(null)">{{ t('schedule.calendars.new') }}</v-btn>
        </div>
        <EmptyState v-if="!loading && calendars.length === 0" icon="mdi-calendar-blank" :title="t('schedule.calendars.empty')" />
        <v-card v-for="c in calendars" :key="c.id" border flat class="mb-4" data-testid="calendar-card">
          <v-card-item :title="c.name">
            <v-card-subtitle class="text-wrap">
              {{ weekdayLabels(c.weekdays) }} · {{ rangeLabel(c.start_date, c.end_date) }}
              <template v-if="c.skip_national_holidays"> · {{ t('schedule.calendars.noHolidays') }}</template>
              · {{ t('schedule.calendars.tripCount', { n: tripsUsing(c.id) }) }}
            </v-card-subtitle>
            <template #append>
              <v-btn size="small" variant="text" icon="mdi-pencil" :aria-label="t('common.edit')" @click="openCalendar(c)" />
              <v-btn
                size="small"
                variant="text"
                icon="mdi-delete"
                :aria-label="t('common.delete')"
                :disabled="tripsUsing(c.id) > 0"
                :title="tripsUsing(c.id) > 0 ? t('schedule.calendars.inUse') : t('common.delete')"
                @click="deleteCalendar(c)"
              />
            </template>
          </v-card-item>
          <v-card-text>
            <div class="text-subtitle-2 mb-1">{{ t('schedule.exceptions.title') }}</div>
            <v-table density="compact">
              <tbody>
                <tr v-for="e in c.calendar_exception" :key="e.id">
                  <td class="tabular">{{ rangeLabel(e.start_date, e.end_date) }}</td>
                  <td>
                    <v-chip size="small" :color="e.type === 'removed' ? 'error' : 'success'" variant="tonal">{{ t(`schedule.exceptions.${e.type}`) }}</v-chip>
                    <span class="text-caption ml-1">{{ t('schedule.exceptions.days', { n: daysInRange(e.start_date, e.end_date) }) }}</span>
                  </td>
                  <td>{{ e.reason }}</td>
                  <td class="text-right"><v-btn size="small" variant="text" icon="mdi-close" :aria-label="t('common.delete')" @click="removeException(e.id)" /></td>
                </tr>
                <tr v-if="c.calendar_exception.length === 0">
                  <td colspan="4" class="text-medium-emphasis">{{ t('schedule.exceptions.none') }}</td>
                </tr>
              </tbody>
            </v-table>
            <v-form class="d-flex flex-wrap ga-2 mt-3 align-start" @submit.prevent="addException(c)">
              <v-text-field v-model="formFor(c.id).start" type="date" :label="t('schedule.exceptions.from')" style="max-width: 180px" hide-details />
              <v-text-field v-model="formFor(c.id).end" type="date" :label="t('schedule.exceptions.to')" style="max-width: 180px" hide-details />
              <v-select
                v-model="formFor(c.id).type"
                :items="[{ value: 'removed', title: t('schedule.exceptions.removed') }, { value: 'added', title: t('schedule.exceptions.added') }]"
                :label="t('schedule.exceptions.type')"
                style="max-width: 200px"
                hide-details
              />
              <v-text-field v-model="formFor(c.id).reason" :label="t('schedule.exceptions.reason')" style="min-width: 200px" hide-details />
              <v-btn type="submit" variant="tonal" :disabled="!formFor(c.id).start">{{ t('common.add') }}</v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-window-item>

      <v-window-item value="preview">
        <v-text-field v-model="previewDate" type="date" :label="t('schedule.preview.date')" style="max-width: 220px" />
        <v-alert type="info" variant="tonal" density="compact" class="mb-3">{{ t('schedule.preview.holidayNote') }}</v-alert>
        <v-card border flat>
          <v-table density="compact" data-testid="preview-table">
            <tbody>
              <tr v-for="row in previewTrips" :key="row.trip.id">
                <td class="tabular" style="width: 6rem">{{ formatTimeOfDay(row.trip.start_time) }}</td>
                <td>
                  <span v-if="row.pattern?.route" class="color-swatch mr-1" :style="{ background: `#${row.pattern.route.color ?? '888888'}` }" />
                  {{ row.pattern?.route ? text(row.pattern.route.name) : '' }} · {{ row.pattern?.name }}
                </td>
                <td>{{ calendarName(row.trip.service_calendar_id) }}</td>
              </tr>
              <tr v-if="previewTrips.length === 0">
                <td class="text-medium-emphasis">{{ t('schedule.preview.none', { date: previewDate }) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-window-item>
    </v-window>

    <TripDialog v-model="tripDialog" :mode="tripMode" :pattern-id="patternId" :trip="tripSelected" :calendars="calendars" @saved="reload" />
    <CalendarDialog v-model="calendarDialog" :calendar="calendarSelected" @saved="reload" />
    <ConfirmDialog
      v-model="deleteOpen"
      :title="t('schedule.trip.deleteTitle')"
      :text="deleteTrip ? t('schedule.trip.deleteText', { time: formatTimeOfDay(deleteTrip.start_time) }) : ''"
      :confirm-label="t('common.delete')"
      :busy="busy"
      @confirm="confirmDeleteTrip"
    />
  </div>
</template>
