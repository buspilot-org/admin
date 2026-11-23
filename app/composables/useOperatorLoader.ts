/**
 * Runs `load` for the current operator now and whenever the operator switcher
 * changes it. Pages keep their data in refs that `load` fills.
 *
 * A newer run makes older ones stale: `load` must check `isStale()` after
 * each await and return without touching its refs, so a slow response for
 * the previous operator never overwrites the current one.
 */
export function useOperatorLoader(load: (operatorId: string, isStale: () => boolean) => Promise<void>) {
  const op = useOperator()
  const loading = ref(false)
  const error = ref<string | null>(null)
  let run = 0

  async function reload() {
    const id = op.currentId.value
    if (!id) return
    const mine = ++run
    const isStale = () => mine !== run || op.currentId.value !== id
    loading.value = true
    error.value = null
    try {
      await load(id, isStale)
    }
    catch (err) {
      if (!isStale()) {
        error.value = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      }
    }
    finally {
      if (mine === run) loading.value = false
    }
  }

  watch(op.currentId, reload, { immediate: true })
  return { loading, error, reload }
}
