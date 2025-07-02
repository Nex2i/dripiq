import type { ReactNode } from 'react'
import { Navigate, useLocation } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'

interface AuthGuardProps {
  children: ReactNode
  redirectTo?: string
}

export default function AuthGuard({ children, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#4361EE' }}></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={redirectTo} search={{ redirect: location.pathname }} />
  }

  return <>{children}</>
}

interface PublicOnlyGuardProps {
  children: ReactNode
}

export function PublicOnlyGuard({ children }: PublicOnlyGuardProps) {
  const { user, loading, session } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#4361EE' }}></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  if (session && user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#4361EE' }}></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" />
  }

  return <>{children}</>
}
