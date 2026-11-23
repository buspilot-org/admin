<script setup lang="ts">
// Create an invite code with create_invite_code (server generates the code
// and stores only its hash), then show it once with QR code and a printable
// sheet.
import type { Database } from '~/types/database.types'

const props = defineProps<{ audienceId: string, audienceName: string }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ created: [] }>()

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const config = useRuntimeConfig()
const op = useOperator()
const text = useText()
const notify = useNotify()
const nuxtApp = useNuxtApp()

const label = ref('')
const expiresDate = ref('')
const maxUses = ref('')
const busy = ref(false)
const created = ref<{ code: string, expiresAt: string | null, label: string | null } | null>(null)
const confirmClose = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    label.value = ''
    expiresDate.value = ''
    maxUses.value = ''
    created.value = null
  }
})

const maxUsesValue = computed(() => (maxUses.value.trim() === '' ? null : Number(maxUses.value)))
const valid = computed(() => maxUsesValue.value === null || (Number.isInteger(maxUsesValue.value) && maxUsesValue.value > 0))
const joinUrl = computed(() => (created.value ? inviteJoinUrl(String(config.public.riderJoinUrl), created.value.code) : ''))

async function create() {
  if (!valid.value) return
  busy.value = true
  // Expiry: end of the chosen day in the operator's time zone.
  const expiresAt = expiresDate.value ? zonedInstant(expiresDate.value, 24 * 3600 - 1, op.timezone.value).toISOString() : undefined
  const { data, error } = await supabase.rpc('create_invite_code', {
    p_audience_id: props.audienceId,
    p_label: label.value.trim() || undefined,
    p_expires_at: expiresAt,
    p_max_uses: maxUsesValue.value ?? undefined,
  })
  const row = data?.[0]
  // The sheet is printed in ja/en/de; messages load lazily per locale.
  await Promise.all((['ja', 'en', 'de'] as const).map(l => nuxtApp.$i18n.loadLocaleMessages(l).catch(() => {})))
  busy.value = false
  if (error || !row) return notify.error(error ?? t('invite.createFailed'))
  created.value = { code: row.code, expiresAt: expiresAt ?? null, label: label.value.trim() || null }
  emit('created')
}

function print() {
  document.body.classList.add('printing-sheet')
  const done = () => {
    document.body.classList.remove('printing-sheet')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}

async function copy() {
  if (!created.value) return
  try {
    await navigator.clipboard.writeText(created.value.code)
    notify.success(t('invite.copied'))
  }
  catch {
    notify.info(t('invite.copyFailed'))
  }
}

function requestClose() {
  if (created.value) confirmClose.value = true
  else open.value = false
}
function close() {
  confirmClose.value = false
  created.value = null
  open.value = false
}
</script>

<template>
  <v-dialog :model-value="open" max-width="800" persistent @update:model-value="requestClose">
    <v-card v-if="!created" :title="t('invite.new')">
      <v-card-text>
        <p class="text-body-2 mb-4">{{ t('invite.newHint', { audience: audienceName }) }}</p>
        <v-text-field v-model="label" :label="t('invite.label')" :hint="t('invite.labelHint')" persistent-hint class="mb-2" data-testid="invite-label" />
        <v-text-field v-model="expiresDate" type="date" :label="t('invite.expires')" />
        <v-text-field v-model="maxUses" type="number" min="1" :label="t('invite.maxUses')" :hint="t('invite.maxUsesHint')" persistent-hint />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">{{ t('common.cancel') }}</v-btn>
        <v-btn color="primary" variant="flat" :loading="busy" :disabled="!valid" data-testid="invite-create" @click="create">{{ t('invite.create') }}</v-btn>
      </v-card-actions>
    </v-card>

    <v-card v-else :title="t('invite.created')">
      <v-card-text>
        <v-alert type="warning" variant="tonal" density="compact" class="mb-4">{{ t('invite.shownOnce') }}</v-alert>
        <div class="d-flex justify-center overflow-auto border rounded">
          <InviteSheet
            :code="created.code"
            :join-url="joinUrl"
            :operator-name="op.operator.value ? text(op.operator.value.name) : ''"
            :audience-name="audienceName"
            :label="created.label"
            :expires-at="created.expiresAt"
          />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn prepend-icon="mdi-content-copy" variant="text" @click="copy">{{ t('invite.copy') }}</v-btn>
        <v-btn prepend-icon="mdi-printer" variant="tonal" @click="print">{{ t('invite.print') }}</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" data-testid="invite-done" @click="requestClose">{{ t('common.done') }}</v-btn>
      </v-card-actions>
    </v-card>

    <Teleport v-if="created" to="body">
      <div class="print-sheet">
        <InviteSheet
          :code="created.code"
          :join-url="joinUrl"
          :operator-name="op.operator.value ? text(op.operator.value.name) : ''"
          :audience-name="audienceName"
          :label="created.label"
          :expires-at="created.expiresAt"
        />
      </div>
    </Teleport>

    <ConfirmDialog
      v-model="confirmClose"
      :title="t('invite.closeTitle')"
      :text="t('invite.closeText')"
      :confirm-label="t('invite.closeConfirm')"
      @confirm="close"
    />
  </v-dialog>
</template>
