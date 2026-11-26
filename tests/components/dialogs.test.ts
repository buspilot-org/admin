import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LiveTripDialog from '~/components/LiveTripDialog.vue'
import DriverVehicleDialog from '~/components/DriverVehicleDialog.vue'
import BrandingImageUpload from '~/components/BrandingImageUpload.vue'
import PostDialog from '~/components/PostDialog.vue'
import SettingsPage from '~/pages/settings.vue'
import { fakeSupabase } from './fakeSupabase'

let fake = fakeSupabase()
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0])
const BUCKET_URL = 'https://project.supabase.co/storage/v1/object/public/operator-branding'

function operatorState(languages: string[], extra: Record<string, unknown> = {}) {
  useState<string | null>('operator-current').value = 'op1'
  useState('operator-memberships').value = [{ role: 'owner', operator: { id: 'op1', slug: 'demo', name: { ja: 'デモ' }, timezone: 'Asia/Tokyo', languages, branding: {}, default_visibility: 'invited_eta', updated_at: '2026-11-26T00:00:00+00:00', ...extra } }]
}
mockNuxtImport('useSupabaseClient', () => () => fake.client)
mockNuxtImport('useSupabaseUser', () => () => ref({ sub: 'me' }))

// Vuetify overlays read window.visualViewport, which happy-dom lacks.
if (!('visualViewport' in globalThis)) {
  Object.defineProperty(globalThis, 'visualViewport', {
    value: { width: 1024, height: 768, offsetLeft: 0, offsetTop: 0, scale: 1, addEventListener() {}, removeEventListener() {} },
    configurable: true,
  })
}

// UI texts are checked in English (the test environment's locale).
// Dialogs render into document.body (teleport).
const body = () => document.body
const byTestId = (id: string) => [...body().querySelectorAll(`[data-testid="${id}"]`)]

afterEach(() => {
  document.body.innerHTML = ''
  fake = fakeSupabase()
})

const vehicles = [{ id: 'v1', name: 'Bus 1' }, { id: 'v2', name: 'Bus 2' }]
const routes = [
  { id: 'r-eta', name: { ja: '朝便A' }, visibility: 'invited_eta' },
  { id: 'r-map', name: { ja: '遠足' }, visibility: 'invited_map' },
]
const stops = [{ id: 's1', name: { ja: '北野坂' } }, { id: 's2', name: { ja: '清水寺' } }]
const audiences = [{ id: 'a1', name: { ja: '保護者' } }]

describe('LiveTripDialog', () => {
  it('lets drivers pick only their vehicle and no audiences', async () => {
    await mountSuspended(LiveTripDialog, {
      props: { modelValue: true, trip: null, vehicles, routes, stops, audiences: null, ownVehicleIds: ['v2'] },
    })
    await flushPromises()
    expect(byTestId('live-vehicle')[0]!.textContent).toContain('Bus 2')
    expect(byTestId('live-audience')).toHaveLength(0)
    expect(byTestId('live-stop-row')).toHaveLength(2)
    expect(body().textContent).toContain('Drivers cannot choose audiences')
  })

  it('caps map permission at arrival times on an arrival-time-only route', async () => {
    const trip = { id: 't1', service_date: '2026-11-26', title: { ja: '遠足' }, vehicle_id: 'v1', route_id: 'r-eta', visible_until: null, status: 'planned' as const }
    await mountSuspended(LiveTripDialog, {
      props: { modelValue: true, trip, vehicles, routes, stops, audiences, ownVehicleIds: null },
    })
    await flushPromises()
    expect(body().textContent).toContain('no audience gets the map')
    const mapSwitch = byTestId('live-audience')[0]!.querySelector('input[type="checkbox"][disabled]')
    expect(mapSwitch).not.toBeNull()
    // It loaded the saved plan of the trip.
    expect(fake.calls.filter(c => c.op === 'eq' && c.args[0] === 'trip_instance_id').map(c => c.table))
      .toEqual(['trip_instance_stop', 'stop_event', 'trip_instance_audience'])
  })
})

describe('LiveTripDialog save', () => {
  const trip = { id: 't1', service_date: '2026-11-26', title: { ja: '遠足' }, vehicle_id: 'v1', route_id: 'r-map', visible_until: null, status: 'planned' as const }
  const savedStops = [
    { stop_sequence: 10, stop_id: 's1', planned_arrival: '2026-11-26T01:00:00+00:00', planned_departure: null },
    { stop_sequence: 20, stop_id: 's2', planned_arrival: '2026-11-26T02:00:00+00:00', planned_departure: null },
  ]
  const tables: Record<string, unknown> = {
    trip_instance_stop: savedStops,
    stop_event: [],
    trip_instance_audience: [{ audience_id: 'a1', can_see_map: true }],
  }

  async function saveTrip(props: { audiences: typeof audiences | null, ownVehicleIds: string[] | null }) {
    operatorState(['ja'])
    fake = fakeSupabase(table => tables[table] ?? [])
    const wrapper = await mountSuspended(LiveTripDialog, { props: { modelValue: true, trip, vehicles, routes, stops, ...props } })
    await flushPromises()
    ;(byTestId('live-save')[0] as HTMLButtonElement).click()
    await flushPromises()
    return wrapper
  }

  it('saves the whole form in one save_live_trip call', async () => {
    const wrapper = await saveTrip({ audiences, ownVehicleIds: null })
    expect(fake.client.rpc).toHaveBeenCalledTimes(1)
    expect(fake.client.rpc).toHaveBeenCalledWith('save_live_trip', {
      p_trip_id: 't1',
      p_operator_id: 'op1',
      p_title: { ja: '遠足' },
      p_vehicle_id: 'v1',
      p_route_id: 'r-map',
      // Empty in the form: two hours after the last stop.
      p_visible_until: '2026-11-26T04:00:00.000Z',
      // The date of a saved trip does not change.
      p_service_date: undefined,
      // Unchanged stops keep their sequence (and their followers).
      p_stops: savedStops.map(s => ({ ...s, planned_arrival: new Date(s.planned_arrival).toISOString() })),
      p_audiences: [{ audience_id: 'a1', can_see_map: true }],
    })
    // No direct writes to the trip tables.
    expect(fake.calls.filter(c => ['insert', 'update', 'upsert', 'delete'].includes(c.op))).toEqual([])
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('leaves the audiences alone for drivers', async () => {
    await saveTrip({ audiences: null, ownVehicleIds: ['v1'] })
    expect(fake.client.rpc).toHaveBeenCalledWith('save_live_trip', expect.objectContaining({ p_trip_id: 't1', p_audiences: undefined }))
  })

  it('keeps the dialog open with the form when the save fails', async () => {
    operatorState(['ja'])
    fake = fakeSupabase(table => tables[table] ?? [])
    fake.client.rpc.mockResolvedValueOnce({ data: null, error: { message: 'live trip not found or not allowed', code: '42501' } } as never)
    const wrapper = await mountSuspended(LiveTripDialog, { props: { modelValue: true, trip, vehicles, routes, stops, audiences, ownVehicleIds: null } })
    await flushPromises()
    ;(byTestId('live-save')[0] as HTMLButtonElement).click()
    await flushPromises()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(useState<{ text: string }[]>('notices').value.at(-1)?.text).toContain('not allowed')
    expect(byTestId('live-stop-row')).toHaveLength(2)
  })
})

describe('DriverVehicleDialog', () => {
  it('inserts new assignments and deletes removed ones', async () => {
    operatorState(['ja'])
    await mountSuspended(DriverVehicleDialog, {
      props: { modelValue: true, vehicle: { id: 'v1', name: 'Bus 1' }, drivers: ['me', 'd2'], assigned: ['d2'] },
    })
    await flushPromises()
    const options = byTestId('driver-option')
    expect(options.map(o => o.textContent)).toEqual(['You', 'Driver d2'])
    // Assign "me", unassign d2.
    for (const option of options) {
      ;(option.querySelector('input') as HTMLInputElement).click()
      await flushPromises()
    }
    const save = [...body().querySelectorAll('button')].find(b => b.textContent?.includes('Save'))!
    save.click()
    await flushPromises()
    const insert = fake.calls.find(c => c.table === 'driver_vehicle' && c.op === 'insert')
    expect(insert?.args[0]).toEqual([{ operator_id: 'op1', user_id: 'me', vehicle_id: 'v1' }])
    expect(fake.calls.some(c => c.table === 'driver_vehicle' && c.op === 'in' && JSON.stringify(c.args) === JSON.stringify(['user_id', ['d2']]))).toBe(true)
  })
})

describe('BrandingImageUpload', () => {
  async function choose(file: File) {
    const wrapper = await mountSuspended(BrandingImageUpload, { props: { modelValue: null, kind: 'logo', operatorId: 'op1', label: 'Logo' } })
    const input = wrapper.find('[data-testid="branding-logo-file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    return wrapper
  }

  it('rejects a file that is too large without uploading it', async () => {
    const wrapper = await choose(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' }))
    expect(wrapper.text()).toContain('at most 2 MB')
    expect(fake.storageCalls).toEqual([])
  })

  it('rejects SVG', async () => {
    const wrapper = await choose(new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))
    expect(wrapper.text()).toContain('PNG, JPEG or WebP')
    expect(fake.storageCalls).toEqual([])
  })

  it('rejects a file whose content is not the claimed type', async () => {
    const wrapper = await choose(new File(['<svg/>'], 'logo.png', { type: 'image/png' }))
    expect(wrapper.text()).toContain('PNG, JPEG or WebP')
    expect(fake.storageCalls).toEqual([])
  })

  it('uploads to a new file under the operator and returns its public URL, without touching the saved file', async () => {
    const wrapper = await choose(new File([PNG_BYTES], 'logo.png', { type: 'image/png' }))
    expect(fake.storageCalls).toHaveLength(1)
    expect(fake.storageCalls[0]).toMatchObject({ table: 'operator-branding', op: 'upload', args: [expect.stringMatching(/^op1\/logo-\d+\.png$/), expect.any(File), { contentType: 'image/png', cacheControl: '31536000' }] })
    const url = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/operator-branding\/op1\/logo-\d+\.png$/)
    expect(wrapper.emitted('uploaded')![0]![0]).toMatch(/^op1\/logo-\d+\.png$/)
  })
})

describe('Settings: branding save', () => {
  const saved = `${BUCKET_URL}/op1/logo-1.png`

  async function saveWithNewLogo() {
    operatorState(['ja'], { branding: { logo_url: saved, color: '1E6FD9' } })
    const wrapper = await mountSuspended(SettingsPage)
    await flushPromises()
    const input = wrapper.find('[data-testid="branding-logo-file"]')
    Object.defineProperty(input.element, 'files', { value: [new File([PNG_BYTES], 'new.png', { type: 'image/png' })], configurable: true })
    await input.trigger('change')
    await flushPromises()
    const save = wrapper.findAll('button').find(b => b.text() === 'Save')!
    await save.trigger('click')
    await flushPromises()
    return wrapper
  }

  it('saves only if nobody saved since loading, then deletes just the replaced logo', async () => {
    fake = fakeSupabase(table => (table === 'operator' ? { id: 'op1', slug: 'demo', name: { ja: 'デモ' }, timezone: 'Asia/Tokyo', languages: ['ja'], branding: {}, default_visibility: 'invited_eta', updated_at: '2026-11-26T01:00:00+00:00' } : []))
    await saveWithNewLogo()
    const update = fake.calls.find(c => c.table === 'operator' && c.op === 'update')!
    expect((update.args[0] as { branding: { logo_url: string } }).branding.logo_url).toMatch(/\/op1\/logo-\d+\.png$/)
    expect(fake.calls).toContainEqual({ table: 'operator', op: 'eq', args: ['updated_at', '2026-11-26T00:00:00+00:00'] })
    const removes = fake.storageCalls.filter(c => c.op === 'remove')
    expect(removes).toEqual([{ table: 'operator-branding', op: 'remove', args: [['op1/logo-1.png']] }])
    // Never a sweep of the folder.
    expect(fake.storageCalls.some(c => c.op === 'list')).toBe(false)
  })

  it('on a conflict, deletes nothing and reloads', async () => {
    fake = fakeSupabase(table => (table === 'operator' ? null : []))
    await saveWithNewLogo()
    expect(fake.storageCalls.filter(c => c.op === 'remove')).toEqual([])
    expect(fake.calls.some(c => c.table === 'staff_role' && c.op === 'select')).toBe(true)
    expect(useState<{ text: string }[]>('notices').value.map(n => n.text).join()).toContain('changed elsewhere')
  })
})

describe('PostDialog', () => {
  it('fills a "no bus today" post as a cancellation in the operator languages', async () => {
    operatorState(['ja', 'en', 'ko'])
    await mountSuspended(PostDialog, { props: { modelValue: true, post: null, audiences: [], routes: [] } })
    await flushPromises()
    // Text typed in a language without template text stays.
    const ko = body().querySelector('[data-testid="i18n-ko"] input') as HTMLInputElement
    ko.value = '오늘 버스 없음'
    ko.dispatchEvent(new Event('input'))
    await flushPromises()
    const button = [...body().querySelectorAll('[data-testid="post-templates"] button')].find(b => b.textContent?.includes('No bus today'))!
    ;(button as HTMLButtonElement).click()
    await flushPromises()
    const values = [...body().querySelectorAll('input, textarea')].map(i => (i as HTMLInputElement).value)
    expect(values).toContain('本日の運行はありません')
    expect(values).toContain('No bus today')
    expect(values).toContain('오늘 버스 없음')
    expect(byTestId('post-category')[0]!.textContent).toContain('Cancellation')
  })
})
