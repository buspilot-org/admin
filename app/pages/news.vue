<script setup lang="ts">
// News: posts for riders, and links / contact information (operator_link).
import type { Database } from '~/types/database.types'

definePageMeta({ roles: ['owner', 'editor'] })

type T = Database['public']['Tables']
type PostRow = T['post']['Row']
type LinkRow = T['operator_link']['Row']

const { t } = useI18n()
const supabase = useSupabaseClient<Database>()
const op = useOperator()
const text = useText()
const notify = useNotify()

const tab = ref<'posts' | 'links'>('posts')
const posts = shallowRef<PostRow[]>([])
const links = shallowRef<LinkRow[]>([])
const audiences = shallowRef<{ id: string, name: unknown }[]>([])
const routes = shallowRef<{ id: string, name: unknown }[]>([])

const { loading, error, reload } = useOperatorLoader(async (operatorId) => {
  const [p, l, a, r] = await Promise.all([
    supabase.from('post').select('*').eq('operator_id', operatorId).order('created_at', { ascending: false }),
    supabase.from('operator_link').select('*').eq('operator_id', operatorId).order('sort_order'),
    supabase.from('audience').select('id, name').eq('operator_id', operatorId).order('created_at'),
    supabase.from('route').select('id, name').eq('operator_id', operatorId).order('sort_order'),
  ])
  for (const res of [p, l, a, r]) if (res.error) throw res.error
  posts.value = p.data ?? []
  links.value = l.data ?? []
  audiences.value = a.data ?? []
  routes.value = r.data ?? []
})

const nameOf = (list: { id: string, name: unknown }[], id: string | null) => (id ? text(list.find(x => x.id === id)?.name) : null)
const statusColor: Record<PostStatus, string> = { draft: 'default', scheduled: 'info', published: 'success', expired: 'default' }
const fmt = (iso: string | null) => (iso ? `${dateInTimeZone(new Date(iso), op.timezone.value)} ${formatClock(iso, op.timezone.value)}` : '—')

// Posts
const postDialog = ref(false)
const postSelected = ref<PostRow | null>(null)
function openPost(p: PostRow | null) {
  postSelected.value = p
  postDialog.value = true
}
const deletingPost = ref<PostRow | null>(null)
const deletePostOpen = computed({ get: () => !!deletingPost.value, set: (v) => { if (!v) deletingPost.value = null } })
const busy = ref(false)
async function deletePost() {
  if (!deletingPost.value) return
  busy.value = true
  const { error: err } = await supabase.from('post').delete().eq('id', deletingPost.value.id)
  busy.value = false
  if (err) return notify.error(err)
  deletingPost.value = null
  await reload()
}

// Links
const linkDialog = ref(false)
const linkEditing = ref<LinkRow | null>(null)
const linkLabel = ref<I18nText>({})
const linkUrl = ref('')
const linkOrder = ref('0')
function openLink(l: LinkRow | null) {
  linkEditing.value = l
  linkLabel.value = i18nFormValue(l?.label, op.languages.value)
  linkUrl.value = l?.url ?? 'https://'
  linkOrder.value = String(l?.sort_order ?? (links.value.length + 1))
  linkDialog.value = true
}
const linkValid = computed(() => !!cleanI18nText(linkLabel.value) && isValidLinkUrl(linkUrl.value) && Number.isInteger(Number(linkOrder.value)))
async function saveLink() {
  if (!linkValid.value || !op.currentId.value) return
  busy.value = true
  const values = { label: cleanI18nText(linkLabel.value)!, url: linkUrl.value.trim(), sort_order: Number(linkOrder.value) }
  const { error: err } = linkEditing.value
    ? await supabase.from('operator_link').update(values).eq('id', linkEditing.value.id)
    : await supabase.from('operator_link').insert({ ...values, operator_id: op.currentId.value })
  busy.value = false
  if (err) return notify.error(err)
  linkDialog.value = false
  notify.success(t('common.saved'))
  await reload()
}
async function deleteLink(l: LinkRow) {
  const { error: err } = await supabase.from('operator_link').delete().eq('id', l.id)
  if (err) return notify.error(err)
  await reload()
}
</script>

<template>
  <div>
    <PageHeader :title="t('news.title')" />
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ t('common.loadFailed', { message: error }) }}</v-alert>

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="posts">{{ t('news.tabs.posts') }}</v-tab>
      <v-tab value="links">{{ t('news.tabs.links') }}</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="posts">
        <div class="mb-3"><v-btn color="primary" prepend-icon="mdi-plus" @click="openPost(null)">{{ t('news.new') }}</v-btn></div>
        <v-card v-if="posts.length > 0" border flat>
          <v-table data-testid="posts-table">
            <thead>
              <tr>
                <th>{{ t('news.postTitle') }}</th>
                <th>{{ t('news.audience') }}</th>
                <th>{{ t('news.publishedAt') }}</th>
                <th>{{ t('news.expires') }}</th>
                <th>{{ t('news.status') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in posts" :key="p.id">
                <td>
                  {{ text(p.title) }}
                  <v-icon v-if="p.send_push" icon="mdi-bell-ring-outline" size="small" :title="t('news.sendPush')" />
                  <div v-if="p.route_id" class="text-caption text-medium-emphasis">{{ nameOf(routes, p.route_id) }}</div>
                </td>
                <td>{{ nameOf(audiences, p.audience_id) ?? t('news.allMembers') }}</td>
                <td class="tabular">{{ fmt(p.published_at) }}</td>
                <td class="tabular">{{ fmt(p.expires_at) }}</td>
                <td><v-chip size="small" variant="tonal" :color="statusColor[postStatus(p)]">{{ t(`news.statuses.${postStatus(p)}`) }}</v-chip></td>
                <td class="text-right text-no-wrap">
                  <v-btn size="small" variant="text" icon="mdi-pencil" :aria-label="t('common.edit')" @click="openPost(p)" />
                  <v-btn size="small" variant="text" icon="mdi-delete" :aria-label="t('common.delete')" @click="deletingPost = p" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
        <EmptyState v-else-if="!loading" icon="mdi-bullhorn" :title="t('news.empty')" />
      </v-window-item>

      <v-window-item value="links">
        <div class="mb-3"><v-btn color="primary" prepend-icon="mdi-plus" @click="openLink(null)">{{ t('links.new') }}</v-btn></div>
        <v-card v-if="links.length > 0" border flat>
          <v-table>
            <thead>
              <tr>
                <th>{{ t('links.label') }}</th>
                <th>{{ t('links.url') }}</th>
                <th>{{ t('links.order') }}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in links" :key="l.id">
                <td>{{ text(l.label) }}</td>
                <td class="text-break">{{ l.url }}</td>
                <td class="tabular">{{ l.sort_order }}</td>
                <td class="text-right text-no-wrap">
                  <v-btn size="small" variant="text" icon="mdi-pencil" :aria-label="t('common.edit')" @click="openLink(l)" />
                  <v-btn size="small" variant="text" icon="mdi-delete" :aria-label="t('common.delete')" @click="deleteLink(l)" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
        <EmptyState v-else-if="!loading" icon="mdi-link-variant" :title="t('links.empty')" />
      </v-window-item>
    </v-window>

    <PostDialog v-model="postDialog" :post="postSelected" :audiences="audiences" :routes="routes" @saved="reload" />
    <ConfirmDialog
      v-model="deletePostOpen"
      :title="t('news.deleteTitle')"
      :text="deletingPost ? text(deletingPost.title) : ''"
      :confirm-label="t('common.delete')"
      :busy="busy"
      @confirm="deletePost"
    />

    <v-dialog v-model="linkDialog" max-width="520">
      <v-card :title="linkEditing ? t('links.edit') : t('links.new')">
        <v-card-text>
          <I18nTextField v-model="linkLabel" :languages="op.languages.value" :label="t('links.label')" required />
          <v-text-field v-model="linkUrl" :label="t('links.url')" :hint="t('links.urlHint')" persistent-hint :error-messages="linkUrl && !isValidLinkUrl(linkUrl) ? [t('links.invalidUrl')] : []" />
          <v-text-field v-model="linkOrder" type="number" :label="t('links.order')" class="mt-2" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="linkDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" :loading="busy" :disabled="!linkValid" @click="saveLink">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
