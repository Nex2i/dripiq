// Quick Action Card Component following Single Responsibility Principle
import React from 'react'
import type { QuickAction } from './types'

interface QuickActionCardProps {
  action: QuickAction
}

/**
 * QuickActionCard Component
 * Single responsibility: Display and handle interaction for a single quick action
 * Dependency Inversion: Action behavior injected via props
 */
export const QuickActionCard: React.FC<QuickActionCardProps> = ({ action }) => {
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = 'var(--color-primary-300)'
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = 'var(--color-border-default)'
  }

  return (
    <button
      onClick={action.action}
      className="rounded-lg shadow-sm p-6 text-left transition-all duration-200 group hover:shadow-md"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-default)',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">
        {action.icon}
      </div>
      <h3
        className="font-semibold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {action.title}
      </h3>
      <p
        className="text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {action.description}
      </p>
    </button>
  )
}