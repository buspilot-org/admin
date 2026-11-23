import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContrastCheck from '~/components/ContrastCheck.vue'

describe('ContrastCheck', () => {
  it('shows ratios for white and black text', async () => {
    const wrapper = await mountSuspended(ContrastCheck, { props: { color: '1E6FD9' } })
    const text = wrapper.text()
    expect(text).toContain('4.85:1')
    expect(text).toContain('4.33:1')
  })

  it('flags an unreadable combination', async () => {
    const wrapper = await mountSuspended(ContrastCheck, { props: { color: 'FFFF00' } })
    // White on yellow fails; black on yellow passes AAA.
    expect(wrapper.text()).toMatch(/1\.07:1/)
    expect(wrapper.text()).toMatch(/19\.56:1/)
  })

  it('explains an invalid colour', async () => {
    const wrapper = await mountSuspended(ContrastCheck, { props: { color: 'blue' } })
    expect(wrapper.find('[data-testid="contrast-check"]').exists()).toBe(false)
  })
})
