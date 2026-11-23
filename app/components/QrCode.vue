<script setup lang="ts">
// QR code as inline SVG (generated locally; the content never leaves the browser).
import { renderSVG } from 'uqr'

const props = withDefaults(defineProps<{ value: string, size?: number, label: string }>(), { size: 200 })
const svg = computed(() => renderSVG(props.value, { ecc: 'M', border: 2 }))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- SVG generated locally by uqr from our own string -->
  <div class="qr" role="img" :aria-label="label" :style="{ width: `${size}px`, height: `${size}px` }" v-html="svg" />
</template>

<style scoped>
.qr :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
