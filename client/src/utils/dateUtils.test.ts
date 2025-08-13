import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { formatDate } from './dateUtils'

let originalTZ: string | undefined

beforeAll(() => {
  originalTZ = process.env.TZ
  process.env.TZ = 'UTC'
})

afterAll(() => {
  process.env.TZ = originalTZ
})

describe('formatDate', () => {
  test('formats an ISO date string to en-US short form', () => {
    const formatted = formatDate('2024-01-05T00:00:00.000Z')
    expect(formatted).toBe('Jan 5, 2024')
  })

  test('formats another ISO date string correctly', () => {
    const formatted = formatDate('2023-07-15T12:30:45.000Z')
    expect(formatted).toBe('Jul 15, 2023')
  })
})
