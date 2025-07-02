import { useState, useEffect } from 'react'
import { Building, AlertCircle } from 'lucide-react'
import {
  useOrganization,
  useUpdateOrganization,
} from '../../hooks/useOrganizationQuery'
import { useAuth } from '../../contexts/AuthContext'

export default function OrganizationPage() {
  const { user } = useAuth()
  const currentTenantId = user?.tenants?.[0]?.id

  const {
    data: organization,
    isLoading,
    error,
  } = useOrganization(currentTenantId || '')
  const updateOrganizationMutation = useUpdateOrganization()

  const [formData, setFormData] = useState({
    tenantName: '',
    organizationName: '',
    organizationWebsite: '',
  })

  const [isDirty, setIsDirty] = useState(false)

  // Update form data when organization data loads
  useEffect(() => {
    if (organization) {
      setFormData({
        tenantName: organization.tenantName || '',
        organizationName: organization.organizationName || '',
        organizationWebsite: organization.organizationWebsite || '',
      })
    }
  }, [organization])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    if (!organization) return

    try {
      await updateOrganizationMutation.mutateAsync({
        id: organization.id,
        data: {
          name: formData.tenantName,
          organizationName: formData.organizationName,
          organizationWebsite: formData.organizationWebsite,
        },
      })
      setIsDirty(false)
    } catch (error) {
      console.error('Error saving organization:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)]"></div>
      </div>
    )
  }

  if (!currentTenantId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
          <span className="text-yellow-700">
            No tenant found. Please contact support.
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-700">
            Error loading organization details
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-gray-900">Organization</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization details.
        </p>
      </div>

      {/* Organization Details */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <Building className="h-5 w-5 text-gray-400 mr-2" />
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Organization Details
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            {/* Tenant Name */}
            <div className="sm:col-span-6">
              <label
                htmlFor="tenant-name"
                className="block text-sm font-medium text-gray-700"
              >
                Tenant Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="tenant-name"
                  id="tenant-name"
                  value={formData.tenantName}
                  onChange={(e) =>
                    handleInputChange('tenantName', e.target.value)
                  }
                  className="shadow-sm focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter tenant name"
                />
              </div>
            </div>

            {/* Organization Name */}
            <div className="sm:col-span-6">
              <label
                htmlFor="org-name"
                className="block text-sm font-medium text-gray-700"
              >
                Organization Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="org-name"
                  id="org-name"
                  value={formData.organizationName}
                  onChange={(e) =>
                    handleInputChange('organizationName', e.target.value)
                  }
                  className="shadow-sm focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Enter organization name"
                />
              </div>
            </div>

            {/* Organization Website */}
            <div className="sm:col-span-6">
              <label
                htmlFor="org-website"
                className="block text-sm font-medium text-gray-700"
              >
                Organization Website
              </label>
              <div className="mt-1">
                <input
                  type="url"
                  name="org-website"
                  id="org-website"
                  value={formData.organizationWebsite}
                  onChange={(e) =>
                    handleInputChange('organizationWebsite', e.target.value)
                  }
                  className="shadow-sm focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!isDirty || updateOrganizationMutation.isPending}
          className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateOrganizationMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
