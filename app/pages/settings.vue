<script setup lang="ts">
// Operator settings (owners): display name per language, branding, languages,
// time zone and default route visibility. Staff management is a follow-up
// (needs an Edge Function for invitations).
import type { Database, Json } from '~/types/database.types'

definePageMeta({ roles: ['owner'] })

type Visibility = Database['public']['Enums']['route_visibility']

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const notify = useNotify()

const LANGUAGE_CHOICES = ['ja', 'en', 'de', 'zh', 'ko', 'pt', 'es', 'vi', 'tl']

const name = ref<I18nText>({})
const color = ref('')
const logoUrl = ref('')
const languages = ref<string[]>([])
const timezone = ref('')
const defaultVisibility = ref<Visibility>('invited_eta')
const previewLang = ref('ja')
const busy = ref(false)
const nuxtApp = useNuxtApp()
// The preview's sample text is shown in each UI language; load them all.
onMounted(() => Promise.all((['ja', 'en', 'de'] as const).map(l => nuxtApp.$i18n.loadLocaleMessages(l).catch(() => {}))))

function fill() {
  const o = op.operator.value
  if (!o) return
  const branding = (o.branding && typeof o.branding === 'object' && !Array.isArray(o.branding) ? o.branding : {}) as Record<string, Json | undefined>
  name.value = i18nFormValue(o.name, o.languages)
  color.value = typeof branding.color === 'string' ? branding.color : DEFAULT_COLOR
  logoUrl.value = typeof branding.logo_url === 'string' ? branding.logo_url : ''
  languages.value = [...o.languages]
  timezone.value = o.timezone
  defaultVisibility.value = o.default_visibility
  previewLang.value = o.languages[0] ?? 'ja'
}
watch(() => op.operator.value?.id, fill, { immediate: true })

const hex = computed(() => normalizeHex(color.value))
const logoValid = computed(() => !logoUrl.value.trim() || /^https:\/\/\S+$/.test(logoUrl.value.trim()))
const timezoneValid = computed(() => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone.value })
    return !!timezone.value
  }
  catch {
    return false
  }
})
const valid = computed(() => !!cleanI18nText(name.value) && !!hex.value && logoValid.value && languages.value.length > 0 && timezoneValid.value)
const languageItems = computed(() => LANGUAGE_CHOICES.map(l => ({ value: l, title: t(`languages.${l}`) })))
// The sample text exists in the UI languages only.
const previewUiLocale = computed(() => (['ja', 'en', 'de'] as const).find(l => l === previewLang.value) ?? 'en')
const previewName = computed(() => pickText(name.value, previewLang.value, languages.value))

async function save() {
  const o = op.operator.value
  if (!valid.value || !o) return
  busy.value = true
  const branding = {
    ...((o.branding && typeof o.branding === 'object' && !Array.isArray(o.branding)) ? o.branding : {}),
    color: hex.value,
    text_color: bestTextColor(hex.value!),
    logo_url: logoUrl.value.trim() || null,
  }
  const { data, error } = await supabase
    .from('operator')
    .update({
      name: cleanI18nText(name.value)!,
      branding,
      languages: languages.value,
      timezone: timezone.value,
      default_visibility: defaultVisibility.value,
    })
    .eq('id', o.id)
    .select('id, slug, name, timezone, languages, branding, default_visibility')
    .single()
  busy.value = false
  if (error) return notify.error(error)
  op.updateOperator(data)
  fill()
  notify.success(t('common.saved'))
}
</script>

<template>
  <div>
    <PageHeader :title="t('settings.title')" :subtitle="op.operator.value?.slug" />
    <v-row>
      <v-col cols="12" lg="7">
        <v-card border flat class="mb-4" :title="t('settings.general')">
          <v-card-text>
            <I18nTextField v-model="name" :languages="languages" :label="t('settings.displayName')" required />
            <v-select v-model="languages" :items="languageItems" :label="t('settings.languages')" :hint="t('settings.languagesHint')" persistent-hint multiple chips closable-chips class="mb-2" />
            <v-text-field v-model="timezone" :label="t('settings.timezone')" :error-messages="timezoneValid ? [] : [t('settings.invalidTimezone')]" class="mt-2" />
            <v-select
              v-model="defaultVisibility"
              :items="(['public', 'invited_map', 'invited_eta'] as const).map(v => ({ value: v, title: t(`visibility.${v}`) }))"
              :label="t('settings.defaultVisibility')"
              :hint="t(`visibilityHint.${defaultVisibility}`)"
              persistent-hint
            />
          </v-card-text>
        </v-card>
        <v-card border flat :title="t('settings.branding')">
          <v-card-text>
            <div class="d-flex ga-3 align-start">
              <v-text-field v-model="color" :label="t('settings.color')" prefix="#" maxlength="7" style="max-width: 180px" data-testid="brand-color" />
              <input
                type="color"
                :value="`#${hex ?? DEFAULT_COLOR}`"
                :aria-label="t('settings.color')"
                style="width: 48px; height: 40px; border: 0; background: none"
                @input="color = ($event.target as HTMLInputElement).value.slice(1).toUpperCase()"
              >
            </div>
            <ContrastCheck :color="color" class="mb-4" />
            <v-text-field v-model="logoUrl" :label="t('settings.logoUrl')" :hint="t('settings.logoHint')" persistent-hint :error-messages="logoValid ? [] : [t('settings.logoInvalid')]" />
          </v-card-text>
        </v-card>
        <div class="d-flex mt-4">
          <v-spacer />
          <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" @click="save">{{ t('common.save') }}</v-btn>
        </div>
      </v-col>
      <v-col cols="12" lg="5">
        <v-card border flat :title="t('settings.preview')" :subtitle="t('settings.previewHint')">
          <v-card-text>
            <v-btn-toggle v-model="previewLang" mandatory density="compact" variant="outlined" divided class="mb-3">
              <v-btn v-for="l in languages" :key="l" :value="l" size="small">{{ l.toUpperCase() }}</v-btn>
            </v-btn-toggle>
            <div class="rider-card rounded-lg overflow-hidden border" :lang="previewLang">
              <div class="pa-4 d-flex align-center ga-3" :style="{ background: `#${hex ?? DEFAULT_COLOR}`, color: `#${bestTextColor(hex ?? DEFAULT_COLOR)}` }">
                <img v-if="logoUrl && logoValid" :src="logoUrl" alt="" width="40" height="40" class="rounded bg-white" style="object-fit: contain" referrerpolicy="no-referrer">
                <v-icon v-else icon="mdi-bus-school" size="40" />
                <div class="text-h6">{{ previewName }}</div>
              </div>
              <div class="pa-4 text-body-2">
                <div class="d-flex justify-space-between"><span>{{ t('settings.sampleStop', {}, { locale: previewUiLocale }) }}</span><span class="tabular">07:41</span></div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
