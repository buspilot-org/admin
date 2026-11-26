<script setup lang="ts">
// Write or edit a post. Title and body per operator language; machine
// translation is a hook for later (utils/translate.ts).
import type { Database } from '~/types/database.types'

type T = Database['public']['Tables']
type PostRow = T['post']['Row']

const props = defineProps<{
  post: PostRow | null
  audiences: { id: string, name: unknown }[]
  routes: { id: string, name: unknown }[]
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const text = useText()
const notify = useNotify()

const title = ref<I18nText>({})
const body = ref<I18nText>({})
const audienceId = ref<string | null>(null)
const routeId = ref<string | null>(null)
const publish = ref<'draft' | 'now' | 'at'>('draft')
const publishAt = ref('')
const expiresAt = ref('')
const sendPush = ref(false)
const category = ref<PostCategory>('general')
const delayMinutes = ref('10')
const busy = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  const p = props.post
  const tz = op.timezone.value
  title.value = i18nFormValue(p?.title, op.languages.value)
  body.value = i18nFormValue(p?.body, op.languages.value)
  audienceId.value = p?.audience_id ?? null
  routeId.value = p?.route_id ?? null
  publish.value = p?.published_at ? 'at' : 'draft'
  publishAt.value = toLocalInput(p?.published_at ?? null, tz)
  expiresAt.value = toLocalInput(p?.expires_at ?? null, tz)
  sendPush.value = p?.send_push ?? false
  category.value = p?.category ?? 'general'
}, { immediate: true })

const categoryItems = computed(() => POST_CATEGORIES.map(c => ({ value: c, title: t(`news.categories.${c}`), props: { prependIcon: POST_CATEGORY_ICON[c] } })))

// Templates fill category, title and body in the operator's languages, and
// suggest a notification; the rest of the form stays as it is.
const delayValid = computed(() => /^\d{1,3}$/.test(delayMinutes.value.trim()) && Number(delayMinutes.value) > 0)
function applyTemplate(template: PostTemplate) {
  const draft = postTemplate(template, op.languages.value)
  category.value = draft.category
  // Only languages the template has text for; others keep what was typed.
  const filled = (texts: I18nText) => Object.fromEntries(Object.entries(texts).filter(([, v]) => v))
  title.value = { ...title.value, ...filled(draft.title) }
  body.value = { ...body.value, ...filled(draft.body) }
  sendPush.value = true
}
function applyNoBusToday() {
  const today = dateInTimeZone(new Date(), op.timezone.value)
  applyTemplate({ kind: 'no_bus_today', date: today })
  // Hide the post after the day.
  if (!expiresAt.value) expiresAt.value = `${addDays(today, 1)}T00:00`
}
function applyDelay() {
  if (!delayValid.value) return
  applyTemplate({ kind: 'delay', minutes: Number(delayMinutes.value) })
}

const audienceItems = computed(() => [
  { value: null, title: t('news.allMembers') },
  ...props.audiences.map(a => ({ value: a.id, title: text(a.name) })),
])
const routeItems = computed(() => [
  { value: null, title: t('news.noRoute') },
  ...props.routes.map(r => ({ value: r.id, title: text(r.name) })),
])

const publishedIso = computed(() => {
  if (publish.value === 'draft') return null
  if (publish.value === 'now') return new Date().toISOString()
  return fromLocalInput(publishAt.value, op.timezone.value)
})
const expiresIso = computed(() => (expiresAt.value ? fromLocalInput(expiresAt.value, op.timezone.value) : null))
const expiryError = computed(() =>
  publishedIso.value && expiresIso.value && expiresIso.value <= publishedIso.value ? t('news.expiryBeforePublish') : null,
)
const valid = computed(() =>
  !!cleanI18nText(title.value)
  && !!cleanI18nText(body.value)
  && !(publish.value === 'at' && !publishedIso.value)
  && !expiryError.value,
)

async function save() {
  if (!valid.value || !op.currentId.value) return
  busy.value = true
  const values = {
    title: cleanI18nText(title.value)!,
    body: cleanI18nText(body.value)!,
    audience_id: audienceId.value,
    route_id: routeId.value,
    published_at: publishedIso.value,
    expires_at: expiresIso.value,
    send_push: sendPush.value,
    category: category.value,
  }
  const { error } = props.post
    ? await supabase.from('post').update(values).eq('id', props.post.id)
    : await supabase.from('post').insert({ ...values, operator_id: op.currentId.value })
  busy.value = false
  if (error) return notify.error(error)
  notify.success(t('common.saved'))
  open.value = false
  emit('saved')
}
</script>

<template>
  <v-dialog v-model="open" max-width="720" scrollable>
    <v-card :title="post ? t('news.edit') : t('news.new')">
      <v-card-text>
        <div v-if="!post" class="mb-4" data-testid="post-templates">
          <div class="text-body-2 mb-2">{{ t('news.templates.title') }}</div>
          <div class="d-flex flex-wrap align-center ga-2">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-bus-alert" @click="applyNoBusToday">{{ t('news.templates.noBusToday') }}</v-btn>
            <v-text-field
              v-model="delayMinutes"
              type="number"
              min="1"
              :label="t('news.templates.minutes')"
              hide-details
              style="max-width: 110px"
              data-testid="delay-minutes"
            />
            <v-btn size="small" variant="tonal" prepend-icon="mdi-clock-alert-outline" :disabled="!delayValid" @click="applyDelay">{{ t('news.templates.delay') }}</v-btn>
          </div>
        </div>
        <v-select v-model="category" :items="categoryItems" :label="t('news.category')" data-testid="post-category" />
        <I18nTextField v-model="title" :languages="op.languages.value" :label="t('news.postTitle')" required />
        <I18nTextField v-model="body" :languages="op.languages.value" :label="t('news.body')" textarea required />
        <div class="d-flex align-center ga-2 mb-4">
          <v-btn size="small" variant="tonal" prepend-icon="mdi-translate" :disabled="!translationAvailable">{{ t('news.suggestTranslations') }}</v-btn>
          <span class="text-caption text-medium-emphasis">{{ t('news.translationLater') }}</span>
        </div>
        <v-row dense>
          <v-col cols="12" sm="6"><v-select v-model="audienceId" :items="audienceItems" :label="t('news.audience')" /></v-col>
          <v-col cols="12" sm="6"><v-select v-model="routeId" :items="routeItems" :label="t('news.route')" /></v-col>
        </v-row>
        <v-radio-group v-model="publish" inline :label="t('news.publish')" hide-details class="mb-2">
          <v-radio value="draft" :label="t('news.draft')" />
          <v-radio value="now" :label="t('news.publishNow')" />
          <v-radio value="at" :label="t('news.publishAt')" />
        </v-radio-group>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field v-if="publish === 'at'" v-model="publishAt" type="datetime-local" :label="t('news.publishAt')" />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field v-model="expiresAt" type="datetime-local" :label="t('news.expires')" :error-messages="expiryError ? [expiryError] : []" clearable />
          </v-col>
        </v-row>
        <v-switch v-model="sendPush" color="primary" :label="t('news.sendPush')" :hint="t('news.sendPushHint')" persistent-hint />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" @click="save">{{ t('common.save') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
