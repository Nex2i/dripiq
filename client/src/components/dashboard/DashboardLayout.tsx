// Dashboard Layout Component following Single Responsibility Principle
import React from 'react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

/**
 * DashboardLayout Component
 * Single responsibility: Provide consistent layout structure for dashboard content
 * Open/Closed: Layout can be extended without modification
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
}) => {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  )
}