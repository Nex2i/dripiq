// Quick Actions Section Component following Single Responsibility Principle
import React from 'react'
import { QuickActionCard } from './QuickActionCard'
import type { QuickAction } from './types'

interface QuickActionsSectionProps {
  actions: QuickAction[]
}

/**
 * QuickActionsSection Component
 * Single responsibility: Layout and display of quick action cards
 * Interface Segregation: Only needs the actions array
 */
export const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({
  actions,
}) => {
  return (
    <div className="mb-8">
      <h2
        className="text-xl font-semibold mb-4"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => (
          <QuickActionCard key={index} action={action} />
        ))}
      </div>
    </div>
  )
}