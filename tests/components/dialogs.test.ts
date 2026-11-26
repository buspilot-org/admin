import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LiveTripDialog from '~/components/LiveTripDialog.vue'
import DriverVehicleDialog from '~/components/DriverVehicleDialog.vue'
import BrandingImageUpload from '~/components/BrandingImageUpload.vue'
import PostDialog from '~/components/PostDialog.vue'
import { fakeSupabase } from './fakeSupabase'

let fake = fakeSupabase()
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

describe('DriverVehicleDialog', () => {
  it('inserts new assignments and deletes removed ones', async () => {
    useState<string | null>('operator-current').value = 'op1'
    useState('operator-memberships').value = [{ role: 'owner', operator: { id: 'op1', slug: 'demo', name: { ja: 'デモ' }, timezone: 'Asia/Tokyo', languages: ['ja'], branding: {}, default_visibility: 'invited_eta' } }]
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

  it('uploads to <operator>/logo.<ext>, removes other formats and returns the public URL', async () => {
    const wrapper = await choose(new File([new Uint8Array(10)], 'logo.webp', { type: 'image/webp' }))
    expect(fake.storageCalls[0]).toMatchObject({ table: 'operator-branding', op: 'upload', args: ['op1/logo.webp', expect.any(File), { upsert: true, contentType: 'image/webp', cacheControl: '3600' }] })
    expect(fake.storageCalls[1]).toMatchObject({ op: 'remove', args: [['op1/logo.png', 'op1/logo.jpg']] })
    const url = wrapper.emitted('update:modelValue')!.at(-1)![0] as string
    expect(url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/operator-branding\/op1\/logo\.webp\?v=\d+$/)
  })
})

describe('PostDialog', () => {
  it('fills a "no bus today" post as a cancellation in the operator languages', async () => {
    useState<string | null>('operator-current').value = 'op1'
    useState('operator-memberships').value = [{ role: 'owner', operator: { id: 'op1', slug: 'demo', name: { ja: 'デモ' }, timezone: 'Asia/Tokyo', languages: ['ja', 'en'], branding: {}, default_visibility: 'invited_eta' } }]
    await mountSuspended(PostDialog, { props: { modelValue: true, post: null, audiences: [], routes: [] } })
    await flushPromises()
    const button = [...body().querySelectorAll('[data-testid="post-templates"] button')].find(b => b.textContent?.includes('No bus today'))!
    ;(button as HTMLButtonElement).click()
    await flushPromises()
    const values = [...body().querySelectorAll('input, textarea')].map(i => (i as HTMLInputElement).value)
    expect(values).toContain('本日の運行はありません')
    expect(values).toContain('No bus today')
    expect(byTestId('post-category')[0]!.textContent).toContain('Cancellation')
  })
})
