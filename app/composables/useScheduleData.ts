import type { Database } from '~/types/database.types'

type T = Database['public']['Tables']
export type CalendarRow = T['service_calendar']['Row'] & { calendar_exception: T['calendar_exception']['Row'][] }
export type PatternRow = Pick<T['trip_pattern']['Row'], 'id' | 'name' | 'route_id' | 'direction'> & {
  route: Pick<T['route']['Row'], 'id' | 'name' | 'short_name' | 'color' | 'text_color'> | null
}
export type TripRow = T['trip']['Row']

/** Patterns (with their route), trips and calendars (with exceptions) of an operator. */
export function useScheduleData() {
  const supabase = useSupabaseClient<Database>()

  async function loadSchedule(operatorId: string) {
    const [patterns, trips, calendars] = await Promise.all([
      supabase
        .from('trip_pattern')
        .select('id, name, route_id, direction, route(id, name, short_name, color, text_color)')
        .eq('operator_id', operatorId)
        .order('name'),
      supabase
        .from('trip')
        .select('*')
        .eq('operator_id', operatorId)
        .order('start_time'),
      supabase
        .from('service_calendar')
        .select('*, calendar_exception(*)')
        .eq('operator_id', operatorId)
        .order('name'),
    ])
    if (patterns.error) throw patterns.error
    if (trips.error) throw trips.error
    if (calendars.error) throw calendars.error
    return {
      patterns: patterns.data as unknown as PatternRow[],
      trips: trips.data,
      calendars: (calendars.data as unknown as CalendarRow[]).map(c => ({
        ...c,
        calendar_exception: [...c.calendar_exception].sort((a, b) => a.start_date.localeCompare(b.start_date)),
      })),
    }
  }

  /**
   * The operator's calendars that run on a date, asked from the server
   * (`service_days()`: weekdays, validity, exceptions and national holidays,
   * as the scheduler decides).
   */
  async function calendarsRunningOn(operatorId: string, date: string): Promise<Set<string>> {
    const { data, error } = await supabase.rpc('service_days', { p_from: date, p_to: date, p_operator_id: operatorId })
    if (error) throw error
    return new Set(data.map(d => d.calendar_id))
  }

  return { loadSchedule, calendarsRunningOn }
}

/** Trips whose calendar runs (see calendarsRunningOn). */
export function tripsOnDate(trips: readonly TripRow[], runningCalendarIds: ReadonlySet<string>) {
  return trips.filter(trip => runningCalendarIds.has(trip.service_calendar_id))
}
