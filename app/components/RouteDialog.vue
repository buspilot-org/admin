<script setup lang="ts">
// Create or edit a route's name, colour and visibility. Stops and shapes come
// from "record a route" (follow-up) or GTFS import.
import type { Database } from '~/types/database.types'

type RouteRow = Database['public']['Tables']['route']['Row']
type Visibility = Database['public']['Enums']['route_visibility']

const props = defineProps<{ route: RouteRow | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [id: string] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const notify = useNotify()

const name = ref<I18nText>({})
const shortName = ref('')
const color = ref(DEFAULT_COLOR)
const visibility = ref<Visibility | 'default'>('default')
const active = ref(true)
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = i18nFormValue(props.route?.name, op.languages.value)
  shortName.value = props.route?.short_name ?? ''
  color.value = props.route?.color ?? DEFAULT_COLOR
  visibility.value = props.route?.visibility ?? 'default'
  active.value = props.route?.active ?? true
}, { immediate: true })

const visibilityItems = computed(() => [
  { value: 'default', title: t('visibility.default', { v: t(`visibility.${op.operator.value?.default_visibility ?? 'invited_eta'}`) }) },
  ...(['public', 'invited_map', 'invited_eta'] as const).map(v => ({ value: v, title: t(`visibility.${v}`) })),
])
const cleanName = computed(() => cleanI18nText(name.value))
const hex = computed(() => normalizeHex(color.value))
const valid = computed(() => !!cleanName.value && !!hex.value)

async function save() {
  if (!valid.value || !op.currentId.value) return
  busy.value = true
  const values = {
    name: cleanName.value!,
    short_name: shortName.value.trim() || null,
    color: hex.value,
    text_color: bestTextColor(hex.value!),
    visibility: visibility.value === 'default' ? null : visibility.value,
    active: active.value,
  }
  const result = props.route
    ? await supabase.from('route').update(values).eq('id', props.route.id).select('id').single()
    : await supabase.from('route').insert({ ...values, operator_id: op.currentId.value }).select('id').single()
  busy.value = false
  if (result.error) return notify.error(result.error)
  notify.success(t('common.saved'))
  open.value = false
  emit('saved', result.data.id)
}
</script>

<template>
  <v-dialog v-model="open" max-width="560">
    <v-card :title="route ? t('routes.edit') : t('routes.new')">
      <v-card-text>
        <I18nTextField v-model="name" :languages="op.languages.value" :label="t('routes.name')" required />
        <v-text-field v-model="shortName" :label="t('routes.shortName')" maxlength="12" />
        <div class="d-flex ga-3 align-start">
          <v-text-field v-model="color" :label="t('routes.color')" prefix="#" maxlength="7" style="max-width: 180px" />
          <input
            type="color"
            :value="`#${hex ?? DEFAULT_COLOR}`"
            :aria-label="t('routes.color')"
            style="width: 48px; height: 40px; border: 0; background: none"
            @input="color = ($event.target as HTMLInputElement).value.slice(1).toUpperCase()"
          >
        </div>
        <ContrastCheck :color="color" class="mb-4" />
        <v-select v-model="visibility" :items="visibilityItems" :label="t('routes.visibility')" :hint="t(`visibilityHint.${visibility === 'default' ? (op.operator.value?.default_visibility ?? 'invited_eta') : visibility}`)" persistent-hint />
        <v-switch v-model="active" :label="t('routes.active')" color="primary" class="mt-2" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
