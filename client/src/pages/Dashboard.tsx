import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const quickActions = [
    {
      title: 'View Campaigns',
      description: 'Manage your drip campaigns',
      icon: '📊',
      action: () => navigate({ to: '/demo/table' }),
    },
    {
      title: 'Create Campaign',
      description: 'Start a new campaign',
      icon: '➕',
      action: () => navigate({ to: '/demo/form/simple' }),
    },
    {
      title: 'Analytics',
      description: 'View campaign performance',
      icon: '📈',
      action: () => navigate({ to: '/demo/tanstack-query' }),
    },
    {
      title: 'Lead Management',
      description: 'Manage your leads',
      icon: '👥',
      action: () => navigate({ to: '/demo/store' }),
    },
  ]

  const stats = [
    { label: 'Active Campaigns', value: '12', change: '+2 this week' },
    { label: 'Leads Recovered', value: '247', change: '+18% this month' },
    { label: 'Revenue Recovered', value: '$42,350', change: '+25% this month' },
    { label: 'Response Rate', value: '34%', change: '+8% this month' },
  ]

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Welcome back,{' '}
            {user?.user?.name || user?.user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p className="text-text-secondary">
            Here's what's happening with your campaigns today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-surface-primary rounded-lg shadow-sm border border-border-primary p-6"
            >
              <p className="text-sm font-medium text-text-secondary mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-text-primary mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-success-600">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              Quick Actions
            </h2>
            <div className="bg-surface-primary rounded-lg shadow-sm border border-border-primary p-6">
              <div className="space-y-4">
                <button
                  onClick={() => navigate({ to: '/leads' })}
                  className="w-full text-left p-4 rounded-lg border border-border-primary hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group"
                >
                  <h3 className="font-medium text-text-primary group-hover:text-primary-600">
                    View All Leads
                  </h3>
                  <p className="text-sm text-text-tertiary">
                    Manage and review your lead pipeline
                  </p>
                </button>
                <div className="border-b border-border-primary"></div>
                <button className="w-full text-left p-4 rounded-lg border border-border-primary hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group">
                  <h3 className="font-medium text-text-primary group-hover:text-primary-600">
                    Create Campaign
                  </h3>
                  <p className="text-sm text-text-tertiary">
                    Set up a new drip campaign
                  </p>
                </button>
                <div className="border-b border-border-primary"></div>
                <button className="w-full text-left p-4 rounded-lg border border-border-primary hover:border-primary-300 hover:bg-primary-50 transition-all duration-200 group">
                  <h3 className="font-medium text-text-primary group-hover:text-primary-600">
                    View Analytics
                  </h3>
                  <p className="text-sm text-text-tertiary">
                    Check campaign performance
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-4">
              Recent Activity
            </h2>
            <div className="bg-surface-primary rounded-lg shadow-sm border border-border-primary">
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    <p className="text-sm text-text-secondary">
                      <span className="font-medium">Campaign "Q4 Follow-up"</span>{' '}
                      sent 15 emails
                    </p>
                    <span className="text-xs text-text-muted">2 hours ago</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                    <p className="text-sm text-text-secondary">
                      <span className="font-medium">3 new leads</span> added to
                      pipeline
                    </p>
                    <span className="text-xs text-text-muted">4 hours ago</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
                    <p className="text-sm text-text-secondary">
                      <span className="font-medium">Lead responded</span> to
                      outreach sequence
                    </p>
                    <span className="text-xs text-text-muted">6 hours ago</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-secondary-500 rounded-full"></div>
                    <p className="text-sm text-text-secondary">
                      <span className="font-medium">Campaign analytics</span>{' '}
                      updated
                    </p>
                    <span className="text-xs text-text-muted">1 day ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            Performance Overview
          </h2>
          <div className="bg-surface-primary rounded-lg shadow-sm border border-border-primary p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Analytics Coming Soon
              </h3>
              <p className="text-text-tertiary">
                Detailed campaign analytics and performance metrics will be
                available in the next release.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
