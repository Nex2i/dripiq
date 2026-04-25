import { supabase } from '../lib/supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

export interface BackendUser {
  id: string
  email: string
  name: string | null
  avatar: string | null
  calendarLink: string | null
  calendarTieIn: string
  createdAt: string
  updatedAt: string
}

export interface UserTenant {
  id: string
  name: string
  isSuperUser: boolean
  role: {
    id: string
    name: string
    permissions: Array<{
      id: string
      name: string
      description?: string
      resource: string
      action: string
    }>
  } | null
  createdAt: string
  updatedAt: string
}

export interface AuthUser {
  user: BackendUser
  tenants: UserTenant[]
  supabaseUser: {
    id: string
    email: string
    emailConfirmed: boolean
  }
}

export interface RegisterData {
  email: string
  password: string
  name: string
  tenantName: string
  enableSsoDomainMapping?: boolean
}

export interface LoginData {
  email: string
  password: string
}

export interface StartSsoLoginOptions {
  email?: string
  domain?: string
}

export interface SsoBootstrapProvisioned {
  status: 'provisioned' | 'already_provisioned'
  user: {
    id: string
    email: string
    name: string | null
  }
  tenant: {
    id: string
    name: string
  }
}

export interface SsoBootstrapRequiresRegistration {
  status: 'requires_registration'
  email: string
  domain: string
}

export interface SsoBootstrapLinkingRequired {
  status: 'linking_required'
  message: string
  email: string
}

export type SsoBootstrapResult =
  | SsoBootstrapProvisioned
  | SsoBootstrapRequiresRegistration
  | SsoBootstrapLinkingRequired

export interface SsoRegisterResult {
  status: 'registered'
  message: string
  user: {
    id: string
    email: string
    name: string | null
  }
  tenant: {
    id: string
    name: string
  }
}

class AuthService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private redirectTo(url: string) {
    window.location.assign(url)
  }

  private createAuthError(message: string, metadata?: Record<string, unknown>) {
    const error = new Error(message) as Error & Record<string, unknown>
    if (metadata) {
      Object.assign(error, metadata)
    }
    return error
  }

  private resolveSsoDomain(options?: StartSsoLoginOptions) {
    const providedDomain = options?.domain?.trim().toLowerCase()
    if (providedDomain) {
      return providedDomain
    }

    const emailDomain = options?.email?.split('@')?.[1]?.trim().toLowerCase()
    if (emailDomain) {
      return emailDomain
    }

    throw this.createAuthError(
      'Enter your work email to discover your company SSO provider.',
      { code: 'sso_domain_required' },
    )
  }

  // Get current Supabase session
  async getCurrentSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session
  }

  // Get current Supabase user
  async getCurrentSupabaseUser(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  }

  // Login with Supabase
  async login(data: LoginData) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return authData
  }

  async startSsoLogin(options?: StartSsoLoginOptions) {
    const resolvedDomain = this.resolveSsoDomain(options)

    const redirectTo = `${window.location.origin}/auth/sso/callback`
    const { data, error } = await supabase.auth.signInWithSSO({
      domain: resolvedDomain,
      options: { redirectTo },
    })

    if (error) {
      throw this.createAuthError(error.message, {
        code: (error as any).code,
        status: (error as any).status,
      })
    }

    if (data?.url) {
      this.redirectTo(data.url)
      return
    }

    throw this.createAuthError('Unable to initialize SSO login redirect', {
      code: 'sso_unavailable',
    })
  }

  // Register with backend (handles both Supabase and backend user creation)
  async register(data: RegisterData) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Registration failed')
    }

    const result = await response.json()

    // If the backend returned a session, set it in Supabase client
    if (result.session) {
      const { error } = await supabase.auth.setSession(result.session)
      if (error) {
        console.error('Error setting session after registration:', error)
      }
    }

    return result
  }

  async bootstrapSsoSession(session?: Session | null): Promise<SsoBootstrapResult> {
    if (!session) {
      session = await this.getCurrentSession()
    }

    if (!session?.access_token) {
      throw new Error('No active SSO session found')
    }

    const response = await fetch(`${this.baseUrl}/auth/sso/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    const result = await response.json()

    if (response.status === 409 && result?.status === 'linking_required') {
      return result
    }

    if (response.ok && result?.status === 'requires_registration') {
      // Clear active SSO session before entering tenant registration flow.
      await supabase.auth.signOut()
      return result
    }

    if (!response.ok) {
      throw new Error(result?.message || 'Failed to bootstrap SSO session')
    }

    return result
  }

  async completeSsoRegistration(
    data: { name: string; tenantName: string },
    session?: Session | null,
  ): Promise<SsoRegisterResult> {
    if (!session) {
      session = await this.getCurrentSession()
    }

    if (!session?.access_token) {
      throw new Error('No active SSO session found')
    }

    const response = await fetch(`${this.baseUrl}/auth/sso/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result?.message || 'Failed to complete SSO registration')
    }

    return result
  }

  // Get current user from backend using JWT token
  async getCurrentUser(session?: Session | null): Promise<AuthUser | null> {
    if (!session) {
      session = await this.getCurrentSession()
    }

    if (!session?.access_token) {
      return null
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, sign out
          await this.logout()
          return null
        }
        throw new Error('Failed to fetch user data')
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching current user:', error)
      return null
    }
  }

  // Logout
  async logout() {
    const session = await this.getCurrentSession()

    // Call backend logout if we have a session
    if (session?.access_token) {
      try {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
        await supabase.auth.signOut()
      } catch (error) {
        console.error('Error during backend logout:', error)
      }
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error)
    }
  }

  // Listen to auth state changes
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void,
  ) {
    return supabase.auth.onAuthStateChange(callback)
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getCurrentSession()
    return !!session
  }

  // Get auth headers for API requests
  async getAuthHeaders(): Promise<{ Authorization: string } | {}> {
    const session = await this.getCurrentSession()

    if (session?.access_token) {
      return {
        Authorization: `Bearer ${session.access_token}`,
      }
    }

    return {}
  }
}

export const authService = new AuthService()
