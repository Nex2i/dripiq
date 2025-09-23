// Statistics Grid Component following Single Responsibility Principle
import React from 'react'
import { StatCard } from './StatCard'
import type { DashboardStat } from './types'

interface StatsGridProps {
  stats: DashboardStat[]
}

/**
 * StatsGrid Component
 * Single responsibility: Layout and display of statistics cards in a grid
 * Liskov Substitution: Can work with any array of DashboardStat objects
 */
export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </div>
  )
}