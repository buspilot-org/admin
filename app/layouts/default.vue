<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const op = useOperator()
const text = useText()
const { mode, cycle } = useThemeMode()
const drawer = ref<boolean | null>(null)

const nav = computed(() => navFor(op.role.value))
const themeIcon = computed(() => ({ system: 'mdi-theme-light-dark', light: 'mdi-white-balance-sunny', dark: 'mdi-weather-night' })[mode.value])

async function signOut() {
  await supabase.auth.signOut()
  op.reset()
  await navigateTo('/login')
}
</script>

<template>
  <v-layout>
  <v-navigation-drawer v-model="drawer" :width="232">
    <div class="pa-4 d-flex align-center ga-2">
      <img src="/favicon.svg" alt="" width="28" height="28">
      <span class="text-h6">Buspilot</span>
    </div>
    <v-list nav density="comfortable">
      <v-list-item
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="t(item.label)"
        :exact="item.to === '/'"
      />
    </v-list>
    <template #append>
      <div v-if="op.role.value" class="pa-4 text-caption text-medium-emphasis">
        {{ t('roles.signedInAs', { role: t(`roles.${op.role.value}`) }) }}
      </div>
    </template>
  </v-navigation-drawer>

  <v-app-bar flat border="b" density="comfortable">
    <v-app-bar-nav-icon :aria-label="t('nav.menu')" @click="drawer = !drawer" />
    <OperatorSwitcher />
    <v-spacer />
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" prepend-icon="mdi-translate" :aria-label="t('nav.language')">
          {{ locale.toUpperCase() }}
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="l in locales"
          :key="l.code"
          :active="l.code === locale"
          :title="l.name"
          @click="setLocale(l.code)"
        />
      </v-list>
    </v-menu>
    <v-btn icon :aria-label="t(`theme.${mode}`)" :title="t(`theme.${mode}`)" @click="cycle">
      <v-icon :icon="themeIcon" />
    </v-btn>
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" icon="mdi-account-circle" :aria-label="t('nav.account')" />
      </template>
      <v-list density="compact">
        <v-list-item :subtitle="user?.email" :title="op.operator.value ? text(op.operator.value.name) : ''" />
        <v-divider />
        <v-list-item prepend-icon="mdi-logout" :title="t('auth.signOut')" @click="signOut" />
      </v-list>
    </v-menu>
  </v-app-bar>

  <v-main>
    <v-container fluid class="pa-4 pa-md-6" style="max-width: 1400px">
      <slot />
    </v-container>
  </v-main>
  </v-layout>
</template>
