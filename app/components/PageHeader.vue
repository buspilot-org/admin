<script setup lang="ts">
defineProps<{ title: string, subtitle?: string }>()
</script>

<template>
  <div class="d-flex flex-wrap align-center ga-2 mb-4">
    <div class="flex-grow-1">
      <h1 class="text-h5">{{ title }}</h1>
      <div v-if="subtitle" class="text-body-2 text-medium-emphasis">{{ subtitle }}</div>
    </div>
    <slot />
  </div>
</template>
