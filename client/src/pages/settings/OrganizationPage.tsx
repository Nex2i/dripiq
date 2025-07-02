import { useState, useEffect } from 'react'
import { Building, AlertCircle, Globe, Tag } from 'lucide-react'
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
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-primary-400)] to-[var(--color-primary-600)] rounded-lg flex items-center justify-center shadow-md">
            <Building className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Organization Settings
          </h2>
        </div>
        <p className="text-gray-600 leading-relaxed">
          Manage your organization's core details and branding information.
          These settings help identify your workspace and organization.
        </p>
      </div>

      {/* Organization Details */}
      <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
        <div className="px-6 py-8 sm:p-10">
          <div className="flex items-center mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary-500)] to-[var(--color-primary-600)] rounded-xl flex items-center justify-center shadow-lg mr-4">
              <Building className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Organization Details
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Configure your organization's basic information
              </p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Tenant Name */}
            <div className="group">
              <label
                htmlFor="tenant-name"
                className="block text-sm font-semibold text-gray-800 mb-3 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Tenant Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Tag className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="tenant-name"
                  id="tenant-name"
                  value={formData.tenantName}
                  onChange={(e) =>
                    handleInputChange('tenantName', e.target.value)
                  }
                  className="block w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your tenant name"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                The internal name for your workspace
              </p>
            </div>

            {/* Organization Name */}
            <div className="group">
              <label
                htmlFor="org-name"
                className="block text-sm font-semibold text-gray-800 mb-3 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Organization Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="org-name"
                  id="org-name"
                  value={formData.organizationName}
                  onChange={(e) =>
                    handleInputChange('organizationName', e.target.value)
                  }
                  className="block w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your organization name"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Your company or organization's public name
              </p>
            </div>

            {/* Organization Website */}
            <div className="group">
              <label
                htmlFor="org-website"
                className="block text-sm font-semibold text-gray-800 mb-3 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Organization Website
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="url"
                  name="org-website"
                  id="org-website"
                  value={formData.organizationWebsite}
                  onChange={(e) =>
                    handleInputChange('organizationWebsite', e.target.value)
                  }
                  className="block w-full pl-12 pr-4 py-4 text-base border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="https://your-company.com"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Your organization's main website URL
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        {isDirty && !updateOrganizationMutation.isPending && (
          <div className="flex items-center text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">
              You have unsaved changes
            </span>
          </div>
        )}
        {!isDirty && !updateOrganizationMutation.isPending && (
          <div className="flex items-center text-green-600 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
            <div className="w-4 h-4 mr-2 flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-sm font-medium">All changes saved</span>
          </div>
        )}
        {updateOrganizationMutation.isPending && (
          <div className="flex items-center text-blue-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent mr-2"></div>
            <span className="text-sm font-medium">Saving changes...</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!isDirty || updateOrganizationMutation.isPending}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white 
                   bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-700)] 
                   rounded-xl shadow-lg shadow-[var(--color-primary-200)]/50
                   hover:from-[var(--color-primary-700)] hover:to-[var(--color-primary-800)] 
                   hover:shadow-xl hover:shadow-[var(--color-primary-300)]/60
                   hover:-translate-y-0.5 
                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]
                   disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-lg
                   transition-all duration-200 ease-in-out transform"
        >
          {updateOrganizationMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-3"></div>
              Saving Changes...
            </>
          ) : (
            <>
              <Building className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  )
}
