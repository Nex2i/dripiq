import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardMetrics } from '../hooks/useDashboardQuery'

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: dashboardData, isLoading, error } = useDashboardMetrics()

  const quickActions = [
    {
      title: 'View Leads',
      description: 'Manage your leads pipeline',
      icon: '👥',
      action: () => navigate({ to: '/leads' }),
    },
    {
      title: 'Add New Lead',
      description: 'Add a new lead to your pipeline',
      icon: '➕',
      action: () => navigate({ to: '/leads/new' }),
    },
    {
      title: 'Settings',
      description: 'Configure your organization',
      icon: '⚙️',
      action: () => navigate({ to: '/settings' }),
    },
    {
      title: 'Team Management',
      description: 'Manage team members',
      icon: '👤',
      action: () => navigate({ to: '/settings/users' }),
    },
  ]

  // Generate stats from real data
  const stats = dashboardData
    ? [
        {
          label: 'Total Leads',
          value: dashboardData.leads.total.toString(),
          change:
            dashboardData.leads.thisWeek > 0
              ? `+${dashboardData.leads.thisWeek} this week`
              : 'No new leads this week',
        },
        {
          label: 'Active Campaigns',
          value: dashboardData.campaigns.active.toString(),
          change: `${dashboardData.campaigns.total} total campaigns`,
        },
        {
          label: 'Emails Sent',
          value: dashboardData.emails.totalSent.toString(),
          change:
            dashboardData.emails.sentThisWeek > 0
              ? `+${dashboardData.emails.sentThisWeek} this week`
              : 'No emails sent this week',
        },
        {
          label: 'Click Rate',
          value: `${dashboardData.emails.clickRate.toFixed(1)}%`,
          change: `${dashboardData.emails.totalClicks} total clicks`,
        },
      ]
    : [
        { label: 'Total Leads', value: '-', change: 'Loading...' },
        { label: 'Active Campaigns', value: '-', change: 'Loading...' },
        { label: 'Emails Sent', value: '-', change: 'Loading...' },
        { label: 'Click Rate', value: '-', change: 'Loading...' },
      ]

  // Handle loading state
  if (isLoading) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-lg shadow-sm border p-6"
                  style={{ borderColor: 'var(--color-border-default)' }}
                >
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle error state
  if (error) {
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
                onClick={() => window.location.reload()}
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

  // Format recent activity timestamp
  const formatActivityTime = (timestamp: string) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffMs = now.getTime() - activityTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return diffMins <= 1 ? 'Just now' : `${diffMins} mins ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    }
  }

  // Get activity icon and color based on type
  const getActivityStyle = (type: string) => {
    switch (type) {
      case 'lead_created':
        return { color: 'var(--color-primary-500)', icon: '👥' }
      case 'campaign_started':
      case 'campaign_created':
        return { color: 'var(--color-success-500)', icon: '📊' }
      case 'email_sent':
        return { color: 'var(--color-surface-500)', icon: '📧' }
      case 'calendar_clicked':
        return { color: 'var(--color-accent-500)', icon: '📅' }
      default:
        return { color: 'var(--color-text-muted)', icon: '•' }
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Welcome back,{' '}
            {user?.user?.name || user?.user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Here's an overview of your lead management and email campaigns.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
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
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className="rounded-lg shadow-sm p-6 text-left transition-all duration-200 group hover:shadow-md"
                style={{
                  backgroundColor: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary-300)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor =
                    'var(--color-border-default)'
                }}
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
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Recent Activity
          </h2>
          <div
            className="rounded-lg shadow-sm"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <div className="p-6">
              {dashboardData && dashboardData.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recentActivity.map((activity) => {
                    const style = getActivityStyle(activity.type)
                    const isCalendarClick = activity.type === 'calendar_clicked'
                    const isNavigable = isCalendarClick && activity.entityId && activity.entityType === 'lead'
                    
                    const handleActivityClick = () => {
                      if (isNavigable) {
                        navigate({ to: `/leads/${activity.entityId}` })
                      }
                    }

                    return (
                      <div
                        key={activity.id}
                        className={`flex items-center space-x-3 ${
                          isNavigable 
                            ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors' 
                            : ''
                        }`}
                        onClick={handleActivityClick}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: style.color }}
                        ></div>
                        <p
                          className="text-sm flex-1"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          <span
                            className={`font-medium ${
                              isNavigable ? 'hover:underline' : ''
                            }`}
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {activity.description}
                          </span>
                        </p>
                        <span
                          className="text-xs flex-shrink-0"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          {formatActivityTime(activity.timestamp)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p style={{ color: 'var(--color-text-muted)' }}>
                    No recent activity to display. Start by adding some leads!
                  </p>
                  <button
                    onClick={() => navigate({ to: '/leads/new' })}
                    className="mt-4 px-4 py-2 rounded-md text-white font-medium"
                    style={{ backgroundColor: 'var(--color-primary-600)' }}
                  >
                    Add Your First Lead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
