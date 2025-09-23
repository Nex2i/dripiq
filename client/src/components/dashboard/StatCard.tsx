// Statistics Card Component following Single Responsibility Principle
import React from 'react'
import type { DashboardStat } from './types'

interface StatCardProps {
  stat: DashboardStat
}

/**
 * StatCard Component
 * Single responsibility: Display a single statistic with proper styling
 * Open/Closed: Can be extended with new styling without modification
 */
export const StatCard: React.FC<StatCardProps> = ({ stat }) => {
  return (
    <div
      className="rounded-lg shadow-sm p-6"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-default)',
      }}
    >
      <p
        className="text-sm font-medium mb-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {stat.label}
      </p>
      <p
        className="text-2xl font-bold mb-1"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {stat.value}
      </p>
      <p
        className="text-sm"
        style={{ color: 'var(--color-success-600)' }}
      >
        {stat.change}
      </p>
    </div>
  )
}