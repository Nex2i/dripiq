import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  signInWithSsoMock: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSessionMock,
      getUser: mocks.getUserMock,
      signInWithSSO: mocks.signInWithSsoMock,
      signInWithPassword: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import { authService } from './auth.service'

describe('authService SSO flows', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080')
    vi.clearAllMocks()
    mocks.getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token_123',
        },
      },
    })
    mocks.getUserMock.mockResolvedValue({
      data: { user: null },
    })
  })

  it('returns requires_registration from bootstrap endpoint', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'requires_registration',
        email: 'user@example.com',
        domain: 'example.com',
      }),
    } as Response)

    const result = await authService.bootstrapSsoSession()

    expect(result.status).toBe('requires_registration')
    const [url, options] = (global.fetch as any).mock.calls[0]
    expect(url).toContain('/api/auth/sso/bootstrap')
    expect(options).toEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token_123',
      },
    })
  })

  it('returns linking_required for account conflict', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        status: 'linking_required',
        message: 'Account linking required',
        email: 'user@example.com',
      }),
    } as Response)

    const result = await authService.bootstrapSsoSession()

    expect(result.status).toBe('linking_required')
  })

  it('completes SSO registration', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'registered',
        message: 'SSO registration completed successfully',
        user: {
          id: 'user_1',
          email: 'user@example.com',
          name: 'First User',
        },
        tenant: {
          id: 'tenant_1',
          name: 'example-org',
        },
      }),
    } as Response)

    const result = await authService.completeSsoRegistration({
      name: 'First User',
      tenantName: 'Example Org',
    })

    expect(result.status).toBe('registered')
    const [url, options] = (global.fetch as any).mock.calls[0]
    expect(url).toContain('/api/auth/sso/register')
    expect(options).toEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token_123',
      },
      body: JSON.stringify({
        name: 'First User',
        tenantName: 'Example Org',
      }),
    })
  })
})
