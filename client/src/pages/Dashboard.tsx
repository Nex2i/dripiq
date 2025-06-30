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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back,{' '}
            {user?.user?.name || user?.user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your campaigns today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <p className="text-sm font-medium text-gray-600 mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-green-600">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-blue-300 transition-all duration-200 group"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-200">
                  {action.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Campaign "Q4 Follow-up"</span>{' '}
                    sent 15 emails
                  </p>
                  <span className="text-xs text-gray-400">2 hours ago</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">3 new leads</span> added to
                    pipeline
                  </p>
                  <span className="text-xs text-gray-400">4 hours ago</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Lead responded</span> to
                    outreach sequence
                  </p>
                  <span className="text-xs text-gray-400">6 hours ago</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Campaign analytics</span>{' '}
                    updated
                  </p>
                  <span className="text-xs text-gray-400">1 day ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
