<script setup lang="ts">
const { t } = useI18n()
const supabase = useSupabaseClient()
const op = useOperator()
async function signOut() {
  await supabase.auth.signOut()
  op.reset()
  await navigateTo('/login')
}
</script>

<template>
  <EmptyState icon="mdi-account-lock" :title="t('noAccess.title')" :text="t('noAccess.text')">
    <v-btn variant="tonal" @click="signOut">{{ t('auth.signOut') }}</v-btn>
  </EmptyState>
</template>
