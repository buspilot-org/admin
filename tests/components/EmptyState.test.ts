import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EmptyState from '~/components/EmptyState.vue'

describe('EmptyState', () => {
  it('renders title, text and slot', async () => {
    const wrapper = await mountSuspended(EmptyState, {
      props: { title: 'No trips', text: 'The engine has not run.' },
      slots: { default: () => 'Action' },
    })
    expect(wrapper.text()).toContain('No trips')
    expect(wrapper.text()).toContain('The engine has not run.')
    expect(wrapper.text()).toContain('Action')
  })
})
