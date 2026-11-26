import { vi } from 'vitest'

export interface Call { table: string, op: string, args: unknown[] }

/**
 * A stand-in for the Supabase client: records every table call and resolves
 * with `{ data, error: null }`. Enough for components that only write.
 */
export function fakeSupabase(data: unknown = []) {
  const calls: Call[] = []
  const storageCalls: Call[] = []
  const result = { data, error: null }
  function builder(table: string) {
    const chain: Record<string, unknown> = {}
    for (const op of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'is', 'order', 'single']) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args })
        return chain
      }
    }
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
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
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/${name}/${path}` } }),
  })
  return {
    calls,
    storageCalls,
    client: { from: builder, storage: { from: bucket }, rpc: vi.fn(async () => result) },
  }
}
