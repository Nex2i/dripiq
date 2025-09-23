// Quick Actions utility functions following Single Responsibility Principle
import type { QuickAction } from '../types'

/**
 * Generate quick actions configuration
 * Single responsibility: Define quick action configurations
 */
export const generateQuickActions = (
  onNavigateToLeads: () => void,
  onNavigateToNewLead: () => void,
  onNavigateToSettings: () => void,
  onNavigateToUsers: () => void
): QuickAction[] => {
  return [
    {
      title: 'View Leads',
      description: 'Manage your leads pipeline',
      icon: '👥',
      action: onNavigateToLeads,
    },
    {
      title: 'Add New Lead',
      description: 'Add a new lead to your pipeline',
      icon: '➕',
      action: onNavigateToNewLead,
    },
    {
      title: 'Settings',
      description: 'Configure your organization',
      icon: '⚙️',
      action: onNavigateToSettings,
    },
    {
      title: 'Team Management',
      description: 'Manage team members',
      icon: '👤',
      action: onNavigateToUsers,
    },
  ]
}