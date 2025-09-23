// Dashboard Error State Component following Single Responsibility Principle
import React from 'react'

interface DashboardErrorStateProps {
  error: Error
  onRetry: () => void
}

/**
 * DashboardErrorState Component
 * Single responsibility: Display error state with retry functionality
 * Dependency Inversion: Retry behavior injected via props
 */
export const DashboardErrorState: React.FC<DashboardErrorStateProps> = ({
  error,
  onRetry,
}) => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div
            className="rounded-lg p-6"
            style={{
              backgroundColor: 'var(--color-error-50)',
              border: '1px solid var(--color-error-200)',
            }}
          >
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--color-error-700)' }}
            >
              Failed to Load Dashboard
            </h2>
            <p style={{ color: 'var(--color-error-600)' }}>
              {error.message ||
                'Something went wrong while loading your dashboard data.'}
            </p>
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 rounded-md text-white font-medium"
              style={{ backgroundColor: 'var(--color-error-600)' }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}