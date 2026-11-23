import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import I18nTextField from '~/components/I18nTextField.vue'

describe('I18nTextField', () => {
  it('shows one input per operator language and keeps extra languages', async () => {
    const wrapper = await mountSuspended(I18nTextField, {
      props: { modelValue: { ja: '朝便A', ko: '아침' }, languages: ['ja', 'en'], label: 'Name' },
    })
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(3)
    expect(inputs[0]!.element.value).toBe('朝便A')
    expect(wrapper.find('[data-testid="i18n-ko"]').exists()).toBe(true)
  })

  it('emits the whole object when one language changes', async () => {
    const wrapper = await mountSuspended(I18nTextField, {
      props: { modelValue: { ja: '', en: 'A' }, languages: ['ja', 'en'], label: 'Name' },
    })
    await wrapper.findAll('input')[0]!.setValue('学校')
    const events = wrapper.emitted('update:modelValue')!
    expect(events.at(-1)![0]).toEqual({ ja: '学校', en: 'A' })
  })

  it('asks for at least one language when required and empty', async () => {
    const wrapper = await mountSuspended(I18nTextField, {
      props: { modelValue: { ja: ' ', en: '' }, languages: ['ja', 'en'], label: 'Name', required: true },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
