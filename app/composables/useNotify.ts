export interface Notice {
  id: number
  text: string
  color: 'success' | 'error' | 'info'
}

/** Snackbar messages. Errors from Supabase are shown with their message (no personal data in them). */
export function useNotify() {
  const notices = useState<Notice[]>('notices', () => [])
  const { t } = useI18n()
  let next = Date.now()

  function push(text: string, color: Notice['color']) {
    notices.value = [...notices.value, { id: next++, text, color }]
  }

  return {
    notices,
    success: (text: string) => push(text, 'success'),
    info: (text: string) => push(text, 'info'),
    error: (err: unknown) => {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err)
      push(t('common.error', { message }), 'error')
    },
    dismiss: (id: number) => {
      notices.value = notices.value.filter(n => n.id !== id)
    },
  }
}
