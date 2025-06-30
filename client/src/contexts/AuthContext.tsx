import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/auth.service'
import type { AuthUser } from '../services/auth.service'

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    name: string
    tenantName: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('Error refreshing user:', error)
      setUser(null)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      await authService.login({ email, password })
      // User will be updated via auth state change listener
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: {
    email: string
    password: string
    name: string
    tenantName: string
  }) => {
    try {
      setLoading(true)
      const result = await authService.register(data)

      // If registration was successful and includes session data,
      // the auth state change listener will automatically update the user
      console.log('Registration completed:', result)

      return result
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      await authService.logout()
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const currentSession = await authService.getCurrentSession()
        setSession(currentSession)

        if (currentSession) {
          const currentUser = await authService.getCurrentUser()
          setUser(currentUser)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (event, sessionChange) => {
      console.log('Auth state changed:', event, sessionChange)
      setSession(sessionChange)

      if (sessionChange) {
        // User signed in, fetch user data from backend
        try {
          const currentUser = await authService.getCurrentUser(sessionChange)
          setUser(currentUser)
        } catch (error) {
          console.error('Error fetching user after auth change:', error)
          setUser(null)
        }
      } else {
        // User signed out
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    user,
    session,
    loading,
    login,
    register,
    logout,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
