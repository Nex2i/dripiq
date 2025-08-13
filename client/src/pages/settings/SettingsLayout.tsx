import { Outlet, Link, useLocation } from '@tanstack/react-router'
import { Users, Shield, CreditCard, Building, Package } from 'lucide-react'

const navigation = [
  {
    name: 'Organization',
    path: '/settings/organization',
    icon: Building,
    description: 'Organization details and branding',
  },
  {
    name: 'Products',
    path: '/settings/products',
    icon: Package,
    description: 'Manage products and sales messaging',
  },
  {
    name: 'Users',
    path: '/settings/users',
    icon: Users,
    description: 'Manage team members and permissions',
  },
  {
    name: 'Security',
    path: '/settings/security',
    icon: Shield,
    description: 'Security and privacy settings',
  },
  {
    name: 'Billing',
    path: '/settings/billing',
    icon: CreditCard,
    description: 'Subscription and payment settings',
  },
]

export default function SettingsLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-10xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl sm:leading-9 sm:truncate">
              Settings
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your workspace preferences and configuration
            </p>
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-12 lg:gap-x-5">
          {/* Sidebar */}
          <aside className="py-6 px-2 sm:px-6 lg:py-0 lg:px-0 lg:col-span-3">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path
                const Icon = item.icon

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`group rounded-md px-3 py-2 flex items-start text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-[var(--color-primary-50)] border-[var(--color-primary-500)] text-[var(--color-primary-700)] border-l-4'
                        : 'text-gray-900 hover:text-gray-900 hover:bg-gray-50 border-l-4 border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Icon
                      className={`flex-shrink-0 -ml-1 mr-3 h-6 w-6 ${
                        isActive
                          ? 'text-[var(--color-primary-500)]'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    <div className="flex-1">
                      <div>{item.name}</div>
                      <div className="text-xs text-gray-500 mt-1 leading-4">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <div className="space-y-6 sm:px-6 lg:px-0 lg:col-span-9">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
