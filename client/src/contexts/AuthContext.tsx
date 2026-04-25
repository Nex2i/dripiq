import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authService } from '../services/auth.service'
import type {
  AuthUser,
  SsoBootstrapResult,
  SsoRegisterResult,
} from '../services/auth.service'
import { useQueryClient } from '@tanstack/react-query'

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  startSsoLogin: () => Promise<void>
  bootstrapSsoSession: () => Promise<SsoBootstrapResult>
  register: (data: {
    email: string
    password: string
    name: string
    tenantName: string
    enableSsoDomainMapping?: boolean
  }) => Promise<void>
  completeSsoRegistration: (data: {
    name: string
    tenantName: string
  }) => Promise<SsoRegisterResult>
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

  const queryClient = useQueryClient()

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

  const startSsoLogin = async () => {
    setLoading(true)
    try {
      await authService.startSsoLogin()
    } finally {
      setLoading(false)
    }
  }

  const bootstrapSsoSession = async () => {
    setLoading(true)
    try {
      const result = await authService.bootstrapSsoSession()
      if (result.status === 'provisioned' || result.status === 'already_provisioned') {
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
      }

      return result
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: {
    email: string
    password: string
    name: string
    tenantName: string
    enableSsoDomainMapping?: boolean
  }) => {
    try {
      setLoading(true)
      const result = await authService.register(data)

      // If registration was successful and includes session data,
      // the auth state change listener will automatically update the user

      return result
    } catch (error) {
      console.error('Registration failed:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const completeSsoRegistration = async (data: {
    name: string
    tenantName: string
  }) => {
    setLoading(true)
    try {
      const result = await authService.completeSsoRegistration(data)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      return result
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      await authService.logout()
      queryClient.clear()
      queryClient.invalidateQueries()
      queryClient.cancelQueries()
      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    // Listen for auth changes - this will handle both initial session and changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (event, sessionChange) => {
      console.log('Auth state changed:', event, sessionChange)

      if (!isMounted) return

      setSession(sessionChange)

      if (sessionChange) {
        try {
          const currentUser = await authService.getCurrentUser(sessionChange)
          if (isMounted) {
            setUser(currentUser)
          }
        } catch (error) {
          console.error('Error fetching user after auth change:', error)
          if (isMounted) {
            setUser(null)
          }
        }
      } else if (!sessionChange) {
        // User signed out
        if (isMounted) {
          setUser(null)
        }
      }

      if (isMounted) {
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextType = {
    user,
    session,
    loading,
    login,
    startSsoLogin,
    bootstrapSsoSession,
    register,
    completeSsoRegistration,
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
