import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InviteSheet from '~/components/InviteSheet.vue'

describe('InviteSheet', () => {
  it('shows the code, a QR code and instructions in three languages', async () => {
    // Messages load per locale; the invite dialog loads all three first.
    await Promise.all((['ja', 'en', 'de'] as const).map(l => useNuxtApp().$i18n.loadLocaleMessages(l)))
    const wrapper = await mountSuspended(InviteSheet, {
      props: {
        code: 'ABCDE-FGHJK',
        joinUrl: 'https://buspilot.org/join#code=ABCDE-FGHJK',
        operatorName: '北野デモ国際学校',
        audienceName: '朝便A 保護者',
        label: 'April letter',
        expiresDate: '2027-03-31',
      },
    })
    expect(wrapper.find('[data-testid="invite-code"]').text()).toBe('ABCDE-FGHJK')
    expect(wrapper.find('svg').exists()).toBe(true)
    const langs = wrapper.findAll('section[lang]').map(s => s.attributes('lang'))
    expect(langs).toEqual(['ja', 'en', 'de'])
    expect(wrapper.text()).toContain('April letter')
    expect(wrapper.text()).toContain('Gültig bis 2027-03-31')
  })
})
