import { supabase } from '../lib/supabaseClient'
import type { User, Session } from '@supabase/supabase-js'

export interface BackendUser {
  id: string
  email: string
  name: string | null
  avatar: string | null
  createdAt: string
  updatedAt: string
}

export interface UserTenant {
  id: string
  name: string
  isSuperUser: boolean
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
}

export interface LoginData {
  email: string
  password: string
}

class AuthService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

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
