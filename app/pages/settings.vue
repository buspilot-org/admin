<script setup lang="ts">
// Operator settings (owners): display name per language, branding, languages,
// time zone and default route visibility. Staff management is a follow-up
// (needs an Edge Function for invitations).
import type { Database } from '~/types/database.types'
import type { Branding } from '~/utils/branding'

definePageMeta({ roles: ['owner'] })

type Visibility = Database['public']['Enums']['route_visibility']

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const notify = useNotify()

const LANGUAGE_CHOICES = ['ja', 'en', 'de', 'zh', 'ko', 'pt', 'es', 'vi', 'tl']

const name = ref<I18nText>({})
const color = ref('')
const logoUrl = ref<string | null>(null)
const coverUrl = ref<string | null>(null)
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
  const branding = readBranding(o.branding)
  name.value = i18nFormValue(o.name, o.languages)
  color.value = branding.color ?? DEFAULT_COLOR
  logoUrl.value = branding.logo_url
  coverUrl.value = branding.cover_url
  languages.value = [...o.languages]
  timezone.value = o.timezone
  defaultVisibility.value = o.default_visibility
  previewLang.value = o.languages[0] ?? 'ja'
}
watch(() => op.operator.value?.id, fill, { immediate: true })

const hex = computed(() => normalizeHex(color.value))
// The schema takes https URLs only; a local Supabase serves Storage over
// http, so images uploaded there cannot be saved (see README).
const logoValid = computed(() => !logoUrl.value || isBrandingUrl(logoUrl.value))
const coverValid = computed(() => !coverUrl.value || isBrandingUrl(coverUrl.value))
const timezoneValid = computed(() => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone.value })
    return !!timezone.value
  }
  catch {
    return false
  }
})
const valid = computed(() => !!cleanI18nText(name.value) && !!hex.value && logoValid.value && coverValid.value && languages.value.length > 0 && timezoneValid.value)
const languageItems = computed(() => LANGUAGE_CHOICES.map(l => ({ value: l, title: t(`languages.${l}`) })))
// The sample text exists in the UI languages only.
const previewUiLocale = computed(() => (['ja', 'en', 'de'] as const).find(l => l === previewLang.value) ?? 'en')
const previewName = computed(() => pickText(name.value, previewLang.value, languages.value))

async function save() {
  const o = op.operator.value
  if (!valid.value || !o) return
  busy.value = true
  // Only the documented keys (the schema rejects others); colours as RRGGBB.
  const branding: Branding = {
    logo_url: logoUrl.value,
    cover_url: coverUrl.value,
    color: hex.value,
    text_color: bestTextColor(hex.value!),
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
  if (error) {
    busy.value = false
    return notify.error(error)
  }
  // Files the saved branding no longer uses (replaced, removed, or uploaded
  // and not saved): delete them (best effort; a later save tries again).
  const storage = supabase.storage.from(BRANDING_BUCKET)
  const listed = await storage.list(o.id, { limit: 100 })
  const stale = staleBrandingPaths(o.id, listed.data ?? [], [branding.logo_url, branding.cover_url])
  if (stale.length > 0) await storage.remove(stale)
  busy.value = false
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
            <template v-if="op.currentId.value">
              <BrandingImageUpload v-model="logoUrl" kind="logo" :operator-id="op.currentId.value" :label="t('settings.logo')" />
              <BrandingImageUpload v-model="coverUrl" kind="cover" :operator-id="op.currentId.value" :label="t('settings.cover')" />
            </template>
            <v-alert v-if="!logoValid || !coverValid" type="warning" variant="tonal" density="compact" data-testid="branding-http">{{ t('settings.httpsOnly') }}</v-alert>
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
              <img v-if="coverUrl && coverValid" :src="coverUrl" alt="" class="d-block w-100" style="height: 96px; object-fit: cover" referrerpolicy="no-referrer">
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
