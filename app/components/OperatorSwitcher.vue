<script setup lang="ts">
// Header: the current operator, with a menu when the staff member works for several.
const { t } = useI18n()
const op = useOperator()
const text = useText()
const route = useRoute()

const items = computed(() => (op.memberships.value ?? []).map(m => ({
  id: m.operator.id,
  name: text(m.operator.name),
  role: m.role,
})))

async function choose(id: string) {
  op.select(id)
  // Pages reload their data when the operator changes. Detail pages belong
  // to the previous operator, and the new role may not open this page.
  const segments = route.path.split('/').filter(Boolean)
  const allowed = !route.meta.roles || (op.role.value !== null && route.meta.roles.includes(op.role.value))
  if (!allowed) await navigateTo('/')
  else if (segments.length > 1) await navigateTo(`/${segments[0]}`)
}
</script>

<template>
  <div v-if="op.operator.value" class="d-flex align-center">
    <v-menu v-if="items.length > 1">
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" append-icon="mdi-chevron-down" data-testid="operator-switcher">
          {{ text(op.operator.value.name) }}
        </v-btn>
      </template>
      <v-list density="compact" :aria-label="t('operator.switch')">
        <v-list-item
          v-for="item in items"
          :key="item.id"
          :active="item.id === op.currentId.value"
          :title="item.name"
          :subtitle="t(`roles.${item.role}`)"
          @click="choose(item.id)"
        />
      </v-list>
    </v-menu>
    <span v-else class="text-subtitle-1 px-2" data-testid="operator-name">{{ text(op.operator.value.name) }}</span>
  </div>
</template>
