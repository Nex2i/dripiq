import { Bell, Mail, Smartphone } from 'lucide-react'

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-gray-900">Notifications</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure how you want to be notified about activity in your
          workspace.
        </p>
      </div>

      {/* Email Notifications */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <Mail className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Email Notifications
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  New leads
                </div>
                <div className="text-sm text-gray-500">
                  Get notified when new leads are added
                </div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  Team invites
                </div>
                <div className="text-sm text-gray-500">
                  Get notified when new team members are invited
                </div>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  Weekly summary
                </div>
                <div className="text-sm text-gray-500">
                  Get a weekly summary of your workspace activity
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Push Notifications */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <Smartphone className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Push Notifications
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  Browser notifications
                </div>
                <div className="text-sm text-gray-500">
                  Show notifications in your browser
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <Bell className="h-5 w-5 text-blue-400 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">
              More notification options coming soon
            </h3>
            <p className="text-sm text-blue-600 mt-1">
              We're working on adding Slack, Discord, and other integrations for
              notifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
