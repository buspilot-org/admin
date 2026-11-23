<script setup lang="ts">
const { notices, dismiss } = useNotify()
const first = computed(() => notices.value[0] ?? null)
</script>

<template>
  <v-snackbar
    v-if="first"
    :key="first.id"
    :model-value="true"
    :color="first.color"
    :timeout="first.color === 'error' ? 8000 : 3000"
    location="bottom right"
    @update:model-value="dismiss(first.id)"
  >
    {{ first.text }}
  </v-snackbar>
</template>
