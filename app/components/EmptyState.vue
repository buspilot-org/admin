<script setup lang="ts">
defineProps<{ icon?: string, title: string, text?: string }>()
</script>

<template>
  <div class="d-flex flex-column align-center text-center pa-8 ga-2" data-testid="empty-state">
    <v-icon v-if="icon" :icon="icon" size="48" class="text-medium-emphasis" />
    <div class="text-subtitle-1">{{ title }}</div>
    <div v-if="text" class="text-body-2 text-medium-emphasis" style="max-width: 560px">{{ text }}</div>
    <slot />
  </div>
</template>
