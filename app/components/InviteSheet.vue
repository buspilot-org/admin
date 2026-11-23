<script setup lang="ts">
// Printable invite sheet: code, QR code and short instructions in ja/en/de.
// Rendered at creation, because the code is shown only once.
import { useI18n } from 'vue-i18n'

defineProps<{
  code: string
  joinUrl: string
  operatorName: string
  audienceName: string
  label?: string | null
  /** Last valid day (YYYY-MM-DD) in the operator's time zone. */
  expiresDate?: string | null
}>()

const { t } = useI18n()
const SHEET_LANGUAGES = ['ja', 'en', 'de'] as const
type SheetLanguage = typeof SHEET_LANGUAGES[number]
const tl = (key: string, lang: SheetLanguage, named: Record<string, unknown> = {}) => t(key, named, { locale: lang })
</script>

<template>
  <article class="invite-sheet" data-testid="invite-sheet">
    <header class="invite-sheet__header">
      <div class="invite-sheet__operator">{{ operatorName }}</div>
      <div class="invite-sheet__audience">{{ audienceName }}</div>
      <div v-if="label" class="invite-sheet__label">{{ label }}</div>
    </header>
    <div class="invite-sheet__main">
      <QrCode :value="joinUrl" :size="200" :label="t('invite.qrLabel')" />
      <div>
        <div class="invite-sheet__code-label">{{ SHEET_LANGUAGES.map(l => tl('sheet.code', l)).join(' / ') }}</div>
        <div class="invite-sheet__code" data-testid="invite-code">{{ code }}</div>
        <div v-if="expiresDate" class="invite-sheet__expires">{{ SHEET_LANGUAGES.map(l => tl('sheet.expires', l, { date: expiresDate })).join(' · ') }}</div>
      </div>
    </div>
    <section v-for="lang in SHEET_LANGUAGES" :key="lang" class="invite-sheet__lang" :lang="lang">
      <h2>{{ tl('sheet.title', lang) }}</h2>
      <ol>
        <li>{{ tl('sheet.step1', lang) }}</li>
        <li>{{ tl('sheet.step2', lang, { code }) }}</li>
        <li>{{ tl('sheet.step3', lang) }}</li>
      </ol>
      <p>{{ tl('sheet.privacy', lang) }}</p>
    </section>
  </article>
</template>

<style scoped>
.invite-sheet {
  background: #fff;
  color: #111;
  padding: 24px;
  max-width: 720px;
  font-size: 13px;
  line-height: 1.5;
}
.invite-sheet__header {
  border-bottom: 2px solid #111;
  padding-bottom: 8px;
  margin-bottom: 16px;
}
.invite-sheet__operator {
  font-size: 20px;
  font-weight: 700;
}
.invite-sheet__audience {
  font-size: 16px;
}
.invite-sheet__label {
  color: #555;
}
.invite-sheet__main {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 16px;
}
.invite-sheet__code-label {
  color: #555;
}
.invite-sheet__code {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.invite-sheet__lang {
  border-top: 1px solid #ccc;
  padding-top: 8px;
  margin-top: 8px;
}
.invite-sheet__lang h2 {
  font-size: 14px;
  margin: 0 0 4px;
}
.invite-sheet__lang ol {
  margin: 0 0 4px 1.2em;
  padding: 0;
}
.invite-sheet__lang p {
  margin: 0;
  color: #444;
}
</style>
