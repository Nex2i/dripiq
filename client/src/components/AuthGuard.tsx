import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'

interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading, session } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span className="ml-2 text-text-secondary">Loading...</span>
        </div>
      </div>
    )
  }

  if (!session || !user) {
    return <Navigate to="/auth/login" replace />
  }

  if (!user.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          <span className="ml-2 text-text-secondary">Loading...</span>
        </div>
      </div>
    )
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  if (session && user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
