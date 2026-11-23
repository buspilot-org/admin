/**
 * Runs `load` for the current operator now and whenever the operator switcher
 * changes it. Pages keep their data in refs that `load` fills.
 */
export function useOperatorLoader(load: (operatorId: string) => Promise<void>) {
  const op = useOperator()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function reload() {
    const id = op.currentId.value
    if (!id) return
    loading.value = true
    error.value = null
    try {
      await load(id)
    }
    catch (err) {
      error.value = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
    }
    finally {
      loading.value = false
    }
  }

  watch(op.currentId, reload, { immediate: true })
  return { loading, error, reload }
}
