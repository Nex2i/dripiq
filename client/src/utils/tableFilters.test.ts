import { describe, expect, test } from 'vitest'
import { fuzzyFilter } from './tableFilters'

const createRow = (value: unknown) =>
  ({
    getValue: (columnId: string) => (columnId === 'name' ? value : undefined),
  }) as any

describe('fuzzyFilter', () => {
  test('returns true for a fuzzy match and records meta', () => {
    const row = createRow('Hello World')
    const addMetaCalls: any[] = []
    const addMeta = (meta: any) => addMetaCalls.push(meta)

    const result = fuzzyFilter(row, 'name', 'hlo', addMeta)

    expect(result).toBe(true)
    expect(addMetaCalls.length).toBe(1)
    expect(addMetaCalls[0]).toHaveProperty('itemRank')
    expect(addMetaCalls[0].itemRank).toHaveProperty('passed', true)
  })

  test('returns false when there is no fuzzy match and records meta', () => {
    const row = createRow('Hello World')
    const addMetaCalls: any[] = []
    const addMeta = (meta: any) => addMetaCalls.push(meta)

    const result = fuzzyFilter(row, 'name', 'xyz', addMeta)

    expect(result).toBe(false)
    expect(addMetaCalls.length).toBe(1)
    expect(addMetaCalls[0]).toHaveProperty('itemRank')
    expect(addMetaCalls[0].itemRank).toHaveProperty('passed', false)
  })
})
