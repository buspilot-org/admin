import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('useOperatorLoader', () => {
  it('drops a slow response for the operator the user switched away from', async () => {
    const current = useState<string | null>('operator-current')
    current.value = 'op-a'
    const gates: Record<string, ReturnType<typeof deferred>> = { 'op-a': deferred(), 'op-b': deferred() }
    const shown: string[] = []
    let loader!: ReturnType<typeof useOperatorLoader>

    await mountSuspended(defineComponent({
      setup() {
        loader = useOperatorLoader(async (id, isStale) => {
          await gates[id]!.promise
          if (isStale()) return
          shown.push(id)
        })
        return () => h('div')
      },
    }))

    // Switch to B while A is still loading; B answers first, A last.
    current.value = 'op-b'
    await nextTick()
    gates['op-b']!.resolve()
    await gates['op-b']!.promise
    await nextTick()
    gates['op-a']!.resolve()
    await gates['op-a']!.promise
    await nextTick()
    await nextTick()

    expect(shown).toEqual(['op-b'])
    expect(loader.loading.value).toBe(false)
    current.value = null
  })
  it('stays loading while the current operator\'s load runs', async () => {
    const current = useState<string | null>('operator-current')
    current.value = 'op-a'
    const gates: Record<string, ReturnType<typeof deferred>> = { 'op-a': deferred(), 'op-b': deferred() }
    let loader!: ReturnType<typeof useOperatorLoader>

    await mountSuspended(defineComponent({
      setup() {
        loader = useOperatorLoader(async (id) => {
          await gates[id]!.promise
        })
        return () => h('div')
      },
    }))

    current.value = 'op-b'
    await nextTick()
    // The old load finishes first: the new one is still running.
    gates['op-a']!.resolve()
    await gates['op-a']!.promise
    await nextTick()
    expect(loader.loading.value).toBe(true)

    gates['op-b']!.resolve()
    await gates['op-b']!.promise
    await nextTick()
    expect(loader.loading.value).toBe(false)
    current.value = null
  })
})
