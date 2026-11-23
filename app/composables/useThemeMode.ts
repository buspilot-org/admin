import { useTheme } from 'vuetify'

export type ThemeMode = 'system' | 'light' | 'dark'
const KEY = 'buspilot_theme'

/** Light / dark / follow the system, remembered in this browser. */
export function useThemeMode() {
  const theme = useTheme()
  const mode = useState<ThemeMode>('theme-mode', () => 'system')

  function apply(next: ThemeMode) {
    mode.value = next
    theme.change(next)
    try {
      localStorage.setItem(KEY, next)
    }
    catch {
      // Not remembered.
    }
  }

  function readStored(): string | null {
    try {
      return localStorage.getItem(KEY)
    }
    catch {
      return null
    }
  }

  function restore() {
    const stored = readStored()
    if (stored === 'light' || stored === 'dark' || stored === 'system') apply(stored)
  }

  function cycle() {
    apply(mode.value === 'system' ? 'light' : mode.value === 'light' ? 'dark' : 'system')
  }

  return { mode, apply, restore, cycle }
}
