import type { Database } from '~/types/database.types'

export interface NationalHoliday {
  date: string
  name: unknown
}

/**
 * Japanese national holidays (`national_holiday`, public reference data, a
 * few dozen rows filled yearly by the server). Loaded once per session.
 */
export function useNationalHolidays() {
  const supabase = useSupabaseClient<Database>()
  const holidays = useState<NationalHoliday[] | null>('national-holidays', () => null)

  async function loadHolidays(): Promise<NationalHoliday[]> {
    if (holidays.value) return holidays.value
    const { data, error } = await supabase.from('national_holiday').select('date, name').order('date')
    if (error) throw error
    holidays.value = data
    return data
  }

  /** The holiday on a date, if any (after loadHolidays). */
  const holidayOn = (date: string) => holidays.value?.find(h => h.date === date) ?? null

  return { holidays, loadHolidays, holidayOn }
}
