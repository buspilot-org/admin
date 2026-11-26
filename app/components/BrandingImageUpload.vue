<script setup lang="ts">
// Upload the operator's logo or cover image to the operator-branding bucket
// (owners only, PNG/JPEG/WebP up to 2 MiB; checked here before the upload
// and again by Storage). The public URL goes into v-model; the settings form
// stores it in operator.branding when saved.
import type { Database } from '~/types/database.types'
import type { BrandingImageError, BrandingImageKind } from '~/utils/branding'

const props = defineProps<{ kind: BrandingImageKind, operatorId: string, label: string }>()
const url = defineModel<string | null>({ required: true })

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const notify = useNotify()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const fileError = ref<BrandingImageError | null>(null)

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  fileError.value = checkBrandingImage(file)
  if (fileError.value) return
  const path = brandingObjectPath(props.operatorId, props.kind, file.type)
  const storage = supabase.storage.from(BRANDING_BUCKET)
  busy.value = true
  const { error } = await storage.upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (error) {
    busy.value = false
    return notify.error(error)
  }
  // A logo.png must not stay behind when a logo.webp replaces it.
  await storage.remove(otherBrandingPaths(props.operatorId, props.kind, path))
  busy.value = false
  url.value = versionedUrl(storage.getPublicUrl(path).data.publicUrl, Date.now())
}

// The file itself is deleted when the settings are saved without it.
function clear() {
  url.value = null
}
</script>

<template>
  <div class="mb-4" :data-testid="`branding-${kind}`">
    <div class="text-body-2 mb-1">{{ label }}</div>
    <div class="d-flex flex-wrap align-center ga-3">
      <div class="branding-thumb border rounded d-flex align-center justify-center" :class="kind">
        <img v-if="url" :src="url" alt="" referrerpolicy="no-referrer" :data-testid="`branding-${kind}-preview`">
        <v-icon v-else :icon="kind === 'logo' ? 'mdi-image-outline' : 'mdi-panorama-variant-outline'" color="medium-emphasis" />
      </div>
      <input ref="input" type="file" accept="image/png,image/jpeg,image/webp" class="d-none" :data-testid="`branding-${kind}-file`" @change="onFile">
      <v-btn size="small" variant="tonal" prepend-icon="mdi-upload" :loading="busy" @click="input?.click()">{{ t('settings.upload') }}</v-btn>
      <v-btn v-if="url" size="small" variant="text" prepend-icon="mdi-delete" :disabled="busy" @click="clear">{{ t('settings.removeImage') }}</v-btn>
    </div>
    <div class="text-caption mt-1" :class="fileError ? 'text-error' : 'text-medium-emphasis'">
      {{ fileError ? t(`settings.imageErrors.${fileError}`) : t(kind === 'logo' ? 'settings.logoHint' : 'settings.coverHint') }}
    </div>
  </div>
</template>

<style scoped>
.branding-thumb { overflow: hidden; background: rgb(var(--v-theme-surface-light)); }
.branding-thumb.logo { width: 64px; height: 64px; }
.branding-thumb.cover { width: 160px; height: 64px; }
.branding-thumb img { width: 100%; height: 100%; object-fit: contain; }
.branding-thumb.cover img { object-fit: cover; }
</style>
