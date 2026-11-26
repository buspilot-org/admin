// Editing live trips against the real database (planned stops keep their
// sequence and followers), and what RLS must refuse. Data is labelled
// "e2e …" or belongs to the test accounts and is removed afterwards.
import { expect, test } from '@playwright/test'
import { DRIVER_STATE, EDITOR_STATE, OWNER_STATE } from './global-setup'
import {
  api,
  asUser,
  AUDIENCE_ID,
  assignDriver,
  deleteDriverVehicles,
  deleteTestLiveTrips,
  deleteUser,
  E2E_LABEL_PREFIX,
  E2E_LIVE_DRIVER_EMAIL,
  ensureStaff,
  OPERATOR_ID,
  riderDevice,
  select,
  tokenOf,
  VEHICLE_ID,
} from './local-supabase'

const STOPS = {
  kitano: 'd0000000-0000-4000-8000-000000000202',
  sannomiya: 'd0000000-0000-4000-8000-000000000203',
  shinKobe: 'd0000000-0000-4000-8000-000000000201',
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())
const jst = (hhmm: string) => new Date(`${today()}T${hhmm}:00+09:00`).toISOString()

/** A live trip made as the owner (RLS applies), with planned stops 10, 20, 30. */
async function ownerTrip(title: string, vehicleId: string | null): Promise<string> {
  const token = await tokenOf(OWNER_STATE)
  const id = crypto.randomUUID()
  const trip = await asUser(token, '/rest/v1/trip_instance', {
    method: 'POST',
    body: JSON.stringify({ id, operator_id: OPERATOR_ID, service_date: today(), kind: 'live', title: { ja: title }, vehicle_id: vehicleId }),
  })
  expect(trip.status).toBe(201)
  const stops = await asUser(token, '/rest/v1/trip_instance_stop', {
    method: 'POST',
    body: JSON.stringify([
      { operator_id: OPERATOR_ID, trip_instance_id: id, stop_sequence: 10, stop_id: STOPS.kitano, planned_arrival: jst('09:00') },
      { operator_id: OPERATOR_ID, trip_instance_id: id, stop_sequence: 20, stop_id: STOPS.sannomiya, planned_arrival: jst('09:20') },
      { operator_id: OPERATOR_ID, trip_instance_id: id, stop_sequence: 30, stop_id: STOPS.shinKobe, planned_arrival: jst('09:40') },
    ]),
  })
  expect(stops.status).toBe(201)
  return id
}

test.describe.configure({ mode: 'serial' })
test.afterAll(deleteTestLiveTrips)

test.describe('editing a live trip', () => {
  test.use({ storageState: OWNER_STATE })

  test('a time change keeps the stop and its follower; a reached stop is locked; a reorder warns', async ({ page }) => {
    const title = `${E2E_LABEL_PREFIX}編集 ${Date.now()}`
    const tripId = await ownerTrip(title, VEHICLE_ID)
    const device = await riderDevice()
    try {
      // A rider of the trip's audience follows the second stop; the bus has
      // reached the first.
      await api('/rest/v1/membership', {
        method: 'POST',
        body: JSON.stringify({ operator_id: OPERATOR_ID, device_id: device, audience_id: AUDIENCE_ID }),
      })
      const audience = await asUser(await tokenOf(OWNER_STATE), '/rest/v1/trip_instance_audience', {
        method: 'POST',
        body: JSON.stringify({ operator_id: OPERATOR_ID, trip_instance_id: tripId, audience_id: AUDIENCE_ID }),
      })
      expect(audience.status).toBe(201)
      await api('/rest/v1/subscription', {
        method: 'POST',
        body: JSON.stringify({ operator_id: OPERATOR_ID, device_id: device, trip_instance_id: tripId, stop_sequence: 20 }),
      })
      await api(`/rest/v1/stop_event?trip_instance_id=eq.${tripId}&stop_sequence=eq.10`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'arrived', arrived_at: new Date().toISOString() }),
      })

      await page.goto('/')
      const row = page.getByTestId('live-trips').locator('tbody tr').filter({ hasText: title })
      await row.getByTestId('edit-live-trip').click()
      const dialog = page.getByTestId('live-trip-dialog')
      const rows = dialog.getByTestId('live-stop-row')
      await expect(rows).toHaveCount(3)
      // The reached stop cannot be changed, removed or moved.
      await expect(rows.nth(0)).toContainText('到着済み')
      await expect(rows.nth(0).getByTestId('live-arrival').locator('input')).toBeDisabled()
      await expect(rows.nth(1).getByRole('button', { name: '上へ' })).toBeDisabled()

      // Time only: same sequence, the follower keeps the subscription.
      await rows.nth(1).getByTestId('live-arrival').locator('input').fill('09:25')
      await dialog.getByTestId('live-save').click()
      await expect(dialog).toBeHidden()
      let stops = await select<{ stop_sequence: number, stop_id: string, planned_arrival: string }>('trip_instance_stop', `trip_instance_id=eq.${tripId}&select=stop_sequence,stop_id,planned_arrival&order=stop_sequence`)
      expect(stops.map(s => s.stop_sequence)).toEqual([10, 20, 30])
      expect(new Date(stops[1]!.planned_arrival).toISOString()).toBe(jst('09:25'))
      expect(await select('subscription', `device_id=eq.${device}&select=stop_sequence`)).toEqual([{ stop_sequence: 20 }])

      // Reorder: the last stop before the second. One stop is re-created,
      // so the dialog warns before saving.
      await row.getByTestId('edit-live-trip').click()
      await rows.nth(2).getByRole('button', { name: '上へ' }).click()
      await rows.nth(1).getByTestId('live-arrival').locator('input').fill('09:15')
      await rows.nth(2).getByTestId('live-arrival').locator('input').fill('09:30')
      await dialog.getByTestId('live-save').click()
      await expect(dialog.getByTestId('live-confirm-loss')).toContainText('1 件')
      await dialog.getByTestId('live-confirm-save').click()
      await expect(dialog).toBeHidden()
      stops = await select('trip_instance_stop', `trip_instance_id=eq.${tripId}&select=stop_sequence,stop_id,planned_arrival&order=stop_sequence`)
      expect(stops.map(s => s.stop_id)).toEqual([STOPS.kitano, STOPS.shinKobe, STOPS.sannomiya])
      // The reached stop and one of the others kept their sequence.
      expect(stops[0]!.stop_sequence).toBe(10)
      expect(stops.filter(s => [20, 30].includes(s.stop_sequence))).toHaveLength(1)
    }
    finally {
      await deleteUser(device)
    }
  })

  test('the server refuses to remove a stop the bus has reached', async () => {
    // The dialog locks reached stops; the trigger is the real guard.
    const title = `${E2E_LABEL_PREFIX}到着済み ${Date.now()}`
    const tripId = await ownerTrip(title, VEHICLE_ID)
    await api(`/rest/v1/stop_event?trip_instance_id=eq.${tripId}&stop_sequence=eq.10`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'arrived', arrived_at: new Date().toISOString() }),
    })
    const owner = await tokenOf(OWNER_STATE)
    const res = await asUser(owner, `/rest/v1/trip_instance_stop?trip_instance_id=eq.${tripId}&stop_sequence=eq.10`, { method: 'DELETE' })
    expect(res.status).toBe(400)

    // The dialog saves with save_live_trip: all or nothing, so a refused stop
    // removal also keeps the new title (no half-saved trip).
    const save = await asUser(owner, '/rest/v1/rpc/save_live_trip', {
      method: 'POST',
      body: JSON.stringify({
        p_trip_id: tripId,
        p_title: { ja: `${title} 変更` },
        p_vehicle_id: VEHICLE_ID,
        // The saved values (null), so only the stop removal could fail.
        p_route_id: null,
        p_visible_until: null,
        p_stops: [
          { stop_sequence: 20, stop_id: STOPS.sannomiya, planned_arrival: jst('09:20') },
          { stop_sequence: 30, stop_id: STOPS.shinKobe, planned_arrival: jst('09:40') },
        ],
      }),
    })
    expect(save.status).toBe(400)
    expect((await save.json()).message).toContain('cannot be removed from the plan')
    const [trip] = await select<{ title: { ja: string } }>('trip_instance', `id=eq.${tripId}&select=title`)
    expect(trip!.title.ja).toBe(title)
    const stops = await select<{ stop_sequence: number }>('trip_instance_stop', `trip_instance_id=eq.${tripId}&select=stop_sequence&order=stop_sequence`)
    expect(stops.map(s => s.stop_sequence)).toEqual([10, 20, 30])
  })
})

test.describe('what RLS refuses', () => {
  test('a driver cannot edit a live trip of another vehicle', async () => {
    const driverId = await ensureStaff(E2E_LIVE_DRIVER_EMAIL, 'driver')
    await deleteDriverVehicles(driverId)
    await assignDriver(driverId, VEHICLE_ID)
    const [other] = await api('/rest/v1/vehicle', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ operator_id: OPERATOR_ID, name: `${E2E_LABEL_PREFIX}Bus 2` }),
    }) as { id: string }[]
    try {
      const tripId = await ownerTrip(`${E2E_LABEL_PREFIX}他の車両 ${Date.now()}`, other!.id)
      const driver = await tokenOf(DRIVER_STATE)
      // Not visible, so the update touches nothing.
      const update = await asUser(driver, `/rest/v1/trip_instance?id=eq.${tripId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ title: { ja: `${E2E_LABEL_PREFIX}乗っ取り` } }),
      })
      expect(await update.json()).toEqual([])
      const stop = await asUser(driver, '/rest/v1/trip_instance_stop', {
        method: 'POST',
        body: JSON.stringify({ operator_id: OPERATOR_ID, trip_instance_id: tripId, stop_sequence: 40, stop_id: STOPS.kitano }),
      })
      expect(stop.status).toBe(403)
      const audience = await asUser(driver, '/rest/v1/trip_instance_audience', {
        method: 'POST',
        body: JSON.stringify({ operator_id: OPERATOR_ID, trip_instance_id: tripId, audience_id: AUDIENCE_ID }),
      })
      expect(audience.status).toBe(403)
      // Moving it onto the driver's own vehicle is refused as well.
      const takeOver = await asUser(driver, `/rest/v1/trip_instance?id=eq.${tripId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ vehicle_id: VEHICLE_ID }),
      })
      expect(await takeOver.json()).toEqual([])
      // The dialog's save call is refused the same way (42501), with nothing saved.
      const save = await asUser(driver, '/rest/v1/rpc/save_live_trip', {
        method: 'POST',
        body: JSON.stringify({ p_trip_id: tripId, p_title: { ja: `${E2E_LABEL_PREFIX}乗っ取り` }, p_vehicle_id: VEHICLE_ID }),
      })
      expect(save.status).toBe(403)
      expect((await save.json()).code).toBe('42501')
      const [trip] = await select<{ vehicle_id: string }>('trip_instance', `id=eq.${tripId}&select=vehicle_id`)
      expect(trip!.vehicle_id).toBe(other!.id)
    }
    finally {
      await deleteTestLiveTrips()
      await api(`/rest/v1/vehicle?id=eq.${other!.id}`, { method: 'DELETE' })
      await deleteDriverVehicles(driverId)
    }
  })

  test('an editor cannot upload branding images', async () => {
    const editor = await tokenOf(EDITOR_STATE)
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    const res = await asUser(editor, `/storage/v1/object/operator-branding/${OPERATOR_ID}/logo-e2e-editor.png`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: png,
    })
    if (res.ok) await api('/storage/v1/object/operator-branding', { method: 'DELETE', body: JSON.stringify({ prefixes: [`${OPERATOR_ID}/logo-e2e-editor.png`] }) })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const listed = await api('/storage/v1/object/list/operator-branding', { method: 'POST', body: JSON.stringify({ prefix: OPERATOR_ID, limit: 100 }) }) as { name: string }[]
    expect(listed.map(f => f.name)).not.toContain('logo-e2e-editor.png')
  })
})
