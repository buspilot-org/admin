import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InviteSheet from '~/components/InviteSheet.vue'

describe('InviteSheet', () => {
  it('shows the code, a QR code and instructions in three languages', async () => {
    const wrapper = await mountSuspended(InviteSheet, {
      props: {
        code: 'ABCDE-FGHJK',
        joinUrl: 'https://app.buspilot.org/join#code=ABCDE-FGHJK',
        operatorName: '北野デモ国際学校',
        audienceName: '朝便A 保護者',
        label: 'April letter',
        expiresAt: '2027-03-31T14:59:59.000Z',
      },
    })
    expect(wrapper.find('[data-testid="invite-code"]').text()).toBe('ABCDE-FGHJK')
    expect(wrapper.find('svg').exists()).toBe(true)
    const langs = wrapper.findAll('section[lang]').map(s => s.attributes('lang'))
    expect(langs).toEqual(['ja', 'en', 'de'])
    expect(wrapper.text()).toContain('April letter')
  })
})
