<script setup lang="ts">
// Shows how readable white and black text are on a colour (WCAG 2).
import { useI18n } from 'vue-i18n'
import { contrastLevel, contrastRatio, normalizeHex } from '~/utils/color'

const props = defineProps<{ color: string | null | undefined }>()
const { t } = useI18n()

const hex = computed(() => normalizeHex(props.color))
const rows = computed(() => {
  if (!hex.value) return []
  return (['FFFFFF', '000000'] as const).map((text) => {
    const ratio = contrastRatio(hex.value!, text)
    return { text, ratio, level: contrastLevel(ratio) }
  })
})
const levelColor = (level: string) => (level === 'fail' ? 'error' : level === 'AA-large' ? 'warning' : 'success')
</script>

<template>
  <div v-if="hex" class="d-flex flex-wrap ga-3" data-testid="contrast-check">
    <div
      v-for="row in rows"
      :key="row.text"
      class="d-flex align-center ga-2"
    >
      <span
        class="px-3 py-1 rounded"
        :style="{ background: `#${hex}`, color: `#${row.text}` }"
      >{{ row.text === 'FFFFFF' ? t('contrast.white') : t('contrast.black') }}</span>
      <span class="tabular">{{ row.ratio.toFixed(2) }}:1</span>
      <v-chip size="small" :color="levelColor(row.level)" variant="tonal">{{ t(`contrast.${row.level}`) }}</v-chip>
    </div>
  </div>
  <div v-else class="text-caption text-error">{{ t('contrast.invalid') }}</div>
</template>
