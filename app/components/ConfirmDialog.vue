<script setup lang="ts">
defineProps<{ title: string, text?: string, confirmLabel: string, busy?: boolean }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ confirm: [] }>()
const { t } = useI18n()
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="title" :text="text">
      <slot />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="error" variant="flat" :loading="busy" @click="emit('confirm')">{{ confirmLabel }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
