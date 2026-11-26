import { vi } from 'vitest'

export interface Call { table: string, op: string, args: unknown[] }

/**
 * A stand-in for the Supabase client: records every table call and resolves
 * with `{ data, error: null }` (or `{ data: null, error }` for the tables in
 * `errors`). Enough for components that only write.
 */
export function fakeSupabase(data: unknown | ((table: string) => unknown) = [], errors: Record<string, { message: string }> = {}) {
  const calls: Call[] = []
  const storageCalls: Call[] = []
  const resultFor = (table: string) => errors[table]
    ? { data: null, error: errors[table] }
    : { data: typeof data === 'function' ? (data as (t: string) => unknown)(table) : data, error: null }
  const result = resultFor('')
  function builder(table: string) {
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'is', 'order', 'single', 'maybeSingle']) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args })
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resultFor(table)).then(resolve)
    return chain
  }
  const bucket = (name: string) => ({
    upload: vi.fn(async (...args: unknown[]) => {
      storageCalls.push({ table: name, op: 'upload', args })
      return { data: {}, error: null }
    }),
    remove: vi.fn(async (...args: unknown[]) => {
      storageCalls.push({ table: name, op: 'remove', args })
      return { data: [], error: null }
    }),
    list: vi.fn(async () => ({ data: [], error: null })),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${name}/${path}` } }),
  })
  return {
    calls,
    storageCalls,
    client: { from: builder, storage: { from: bucket }, rpc: vi.fn(async () => result) },
  }
}
