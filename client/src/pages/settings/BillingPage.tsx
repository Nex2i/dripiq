import { CreditCard, Download, Calendar, DollarSign } from 'lucide-react'

export default function BillingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-gray-900">Billing</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your subscription and billing information.
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Current Plan
            </h3>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-[var(--color-primary-200)] rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-blue-900">
                  Free Trial
                </h4>
                <p className="text-sm text-[var(--color-primary-600)] mt-1">
                  14 days remaining in your trial
                </p>
                <p className="text-xs text-blue-500 mt-2">
                  Includes: Up to 5 team members, 1,000 leads, Basic support
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900">$0</div>
                <div className="text-sm text-[var(--color-primary-600)]">
                  per month
                </div>
              </div>
            </div>

            <div className="mt-4">
              <button className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-md text-sm font-medium">
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <CreditCard className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Payment Method
            </h3>
          </div>

          <div className="text-center py-8">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h4 className="mt-2 text-sm font-medium text-gray-900">
              No payment method on file
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              Add a payment method to continue after your trial ends.
            </p>
            <button className="mt-4 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-md text-sm font-medium">
              Add Payment Method
            </button>
          </div>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Billing History
              </h3>
            </div>
            <button className="text-[var(--color-primary-600)] hover:text-blue-700 text-sm font-medium flex items-center">
              <Download className="h-4 w-4 mr-1" />
              Download All
            </button>
          </div>

          <div className="text-center py-8">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h4 className="mt-2 text-sm font-medium text-gray-900">
              No billing history
            </h4>
            <p className="mt-1 text-sm text-gray-500">
              Your billing history will appear here once you start a paid
              subscription.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
