<script setup lang="ts">
// Callback route of @nuxtjs/supabase. Sign-in uses one-time codes, so this
// only forwards a signed-in user.
definePageMeta({ layout: 'blank', public: true })
const session = useSupabaseSession()
watchEffect(() => navigateTo(session.value ? '/' : '/login'))
</script>

<template>
  <div />
</template>
