<script setup lang="ts">
// Sign-in with an email one-time code (Supabase Auth). No passwords.
// Accounts are not created here: staff get an account when invited.
definePageMeta({ layout: 'blank', public: true })

const { t } = useI18n()
const supabase = useSupabaseClient()
const session = useSupabaseSession()
const redirect = useSupabaseCookieRedirect()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))

async function sendCode() {
  if (!emailValid.value) return
  busy.value = true
  error.value = null
  const { error: err } = await supabase.auth.signInWithOtp({
    email: email.value.trim(),
    options: { shouldCreateUser: false },
  })
  busy.value = false
  // Do not tell whether an account exists: the same message either way,
  // except for rate limits, which the user can act on.
  if (err && err.status === 429) {
    error.value = t('auth.rateLimited')
    return
  }
  step.value = 'code'
}

async function verify() {
  const token = code.value.replace(/\s/g, '')
  if (!/^\d{6,10}$/.test(token)) return
  busy.value = true
  error.value = null
  const { error: err } = await supabase.auth.verifyOtp({ email: email.value.trim(), token, type: 'email' })
  busy.value = false
  if (err) {
    error.value = t('auth.invalidCode')
    return
  }
  const target = redirect.pluck()
  await navigateTo(target && target.startsWith('/') && !target.startsWith('//') ? target : '/')
}

watchEffect(() => {
  if (session.value && step.value === 'email') navigateTo('/')
})
</script>

<template>
  <v-container class="fill-height d-flex align-center justify-center">
    <v-card width="420" max-width="100%" class="pa-2" border flat>
      <v-card-item>
        <div class="d-flex align-center ga-2 mb-2">
          <img src="/favicon.svg" alt="" width="32" height="32">
          <span class="text-h5">Buspilot</span>
        </div>
        <v-card-title class="px-0">{{ t('auth.title') }}</v-card-title>
        <v-card-subtitle class="px-0 text-wrap">
          {{ step === 'email' ? t('auth.emailHint') : t('auth.codeHint', { email }) }}
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" density="compact">{{ error }}</v-alert>
        <v-form v-if="step === 'email'" @submit.prevent="sendCode">
          <v-text-field
            v-model="email"
            :label="t('auth.email')"
            type="email"
            autocomplete="email"
            autofocus
            name="email"
          />
          <v-btn type="submit" color="primary" block :loading="busy" :disabled="!emailValid">
            {{ t('auth.sendCode') }}
          </v-btn>
        </v-form>
        <v-form v-else @submit.prevent="verify">
          <v-text-field
            v-model="code"
            :label="t('auth.code')"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
            name="code"
          />
          <v-btn type="submit" color="primary" block :loading="busy">{{ t('auth.signIn') }}</v-btn>
          <v-btn variant="text" block class="mt-2" @click="step = 'email'; code = ''">{{ t('auth.otherEmail') }}</v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
