<script setup lang="ts">
// One input per operator language for translatable jsonb text.
import { useI18n } from 'vue-i18n'
import type { I18nText } from '~/utils/i18nText'

const props = withDefaults(defineProps<{
  modelValue: I18nText
  languages: readonly string[]
  label: string
  textarea?: boolean
  /** At least one language must be filled. */
  required?: boolean
}>(), { textarea: false, required: false })

const emit = defineEmits<{ 'update:modelValue': [value: I18nText] }>()
const { t } = useI18n()

const shown = computed(() => {
  const extra = Object.keys(props.modelValue).filter(l => !props.languages.includes(l))
  return [...props.languages, ...extra]
})
const empty = computed(() => !Object.values(props.modelValue).some(v => v.trim()))

function update(lang: string, value: string) {
  emit('update:modelValue', { ...props.modelValue, [lang]: value })
}

function languageName(lang: string) {
  const key = `languages.${lang}`
  const name = t(key)
  return name === key ? lang : name
}
</script>

<template>
  <fieldset class="i18n-field mb-2">
    <legend class="text-body-2 mb-1">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </legend>
    <template v-for="lang in shown" :key="lang">
      <v-textarea
        v-if="textarea"
        :model-value="modelValue[lang] ?? ''"
        :label="languageName(lang)"
        :lang="lang"
        rows="3"
        auto-grow
        :data-testid="`i18n-${lang}`"
        @update:model-value="update(lang, $event)"
      />
      <v-text-field
        v-else
        :model-value="modelValue[lang] ?? ''"
        :label="languageName(lang)"
        :lang="lang"
        :data-testid="`i18n-${lang}`"
        @update:model-value="update(lang, $event)"
      />
    </template>
    <div v-if="required && empty" class="text-caption text-error" role="alert">{{ t('form.oneLanguageRequired') }}</div>
  </fieldset>
</template>

<style scoped>
.i18n-field {
  border: 0;
  padding: 0;
  margin: 0;
}
</style>
