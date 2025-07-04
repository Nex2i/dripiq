import { useState, useEffect } from 'react'
import {
  Building,
  AlertCircle,
  Globe,
  Tag,
  RotateCcw,
  FileText,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  useOrganization,
  useUpdateOrganization,
  useResyncOrganization,
} from '../../hooks/useOrganizationQuery'
import { useAuth } from '../../contexts/AuthContext'
import AIAnalysisSummary from '../../components/AIAnalysisSummary'
import BrandIdentity from '../../components/BrandIdentity'

export default function OrganizationPage() {
  const { user } = useAuth()
  const currentTenantId = user?.tenants?.[0]?.id

  const {
    data: organization,
    isLoading,
    error,
  } = useOrganization(currentTenantId || '')
  const updateOrganizationMutation = useUpdateOrganization()
  const resyncOrganizationMutation = useResyncOrganization()

  const [formData, setFormData] = useState({
    tenantName: '',
    organizationName: '',
    organizationWebsite: '',
    summary: '',
    products: [] as string[],
    services: [] as string[],
    differentiators: [] as string[],
    targetMarket: '',
    tone: '',
    logo: null as string | null,
    brandColors: [] as string[],
  })

  const [isDirty, setIsDirty] = useState(false)

  // Update form data when organization data loads
  useEffect(() => {
    if (organization) {
      setFormData({
        tenantName: organization.tenantName || '',
        organizationName: organization.organizationName || '',
        organizationWebsite: organization.organizationWebsite || '',
        summary: organization.summary || '',
        products: Array.isArray(organization.products)
          ? organization.products
          : [],
        services: Array.isArray(organization.services)
          ? organization.services
          : [],
        differentiators: Array.isArray(organization.differentiators)
          ? organization.differentiators
          : [],
        targetMarket: organization.targetMarket || '',
        tone: organization.tone || '',
        logo: organization.logo || null,
        brandColors: Array.isArray(organization.brandColors)
          ? organization.brandColors
          : [],
      })
    }
  }, [organization])

  const handleInputChange = (field: string, value: string) => {
    let processedValue = value

    // Auto-format tenant name: lowercase and replace spaces with hyphens
    if (field === 'tenantName') {
      processedValue = value.toLowerCase().replace(/\s+/g, '-')
    }

    setFormData((prev) => ({
      ...prev,
      [field]: processedValue,
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
          summary: formData.summary,
          products: formData.products,
          services: formData.services,
          differentiators: formData.differentiators,
          targetMarket: formData.targetMarket,
          tone: formData.tone,
          logo: formData.logo,
          brandColors: formData.brandColors,
        },
      })
      setIsDirty(false)
    } catch (error) {
      console.error('Error saving organization:', error)
    }
  }

  const handleResync = async () => {
    if (!organization) return

    try {
      await resyncOrganizationMutation.mutateAsync(organization.id)
    } catch (error) {
      console.error('Error resyncing organization:', error)
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
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[var(--color-primary-400)] to-[var(--color-primary-600)] rounded-lg flex items-center justify-center shadow-md">
              <Building className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Organization Settings
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Resync Button */}
            <button
              onClick={handleResync}
              disabled={resyncOrganizationMutation.isPending}
              className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:cursor-pointer transition-all duration-200"
              title="Resync organization details"
            >
              <RotateCcw
                className={`h-4 w-4 mr-2 transition-transform duration-600 ${
                  resyncOrganizationMutation.isPending
                    ? 'animate-[spin_1s_linear_infinite_reverse]'
                    : 'group-hover:-rotate-180'
                }`}
              />
              {resyncOrganizationMutation.isPending ? 'Resyncing...' : 'Resync'}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || updateOrganizationMutation.isPending}
              className="group relative inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white 
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

        {/* Status Indicators */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-600">
            Manage your organization's core details and information.
          </p>

          <div className="flex items-center">
            {isDirty && !updateOrganizationMutation.isPending && (
              <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                <AlertCircle className="h-3 w-3 mr-1.5" />
                <span className="text-xs font-medium">Unsaved changes</span>
              </div>
            )}
            {!isDirty && !updateOrganizationMutation.isPending && (
              <div className="flex items-center text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                <div className="w-3 h-3 mr-1.5 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-xs font-medium">All changes saved</span>
              </div>
            )}
            {updateOrganizationMutation.isPending && (
              <div className="flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent mr-1.5"></div>
                <span className="text-xs font-medium">Saving changes...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Organization Details */}
        <div className="space-y-6">
          <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
            <div className="px-6 py-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Organization Details
              </h2>
              <div className="space-y-5">
                {/* Tenant Name */}
                <div className="group">
                  <label
                    htmlFor="tenant-name"
                    className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
                  >
                    Tenant Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Tag className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                    </div>
                    <input
                      type="text"
                      name="tenant-name"
                      id="tenant-name"
                      value={formData.tenantName}
                      onChange={(e) =>
                        handleInputChange('tenantName', e.target.value)
                      }
                      className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                               placeholder:text-gray-400 
                               hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                               focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50"
                      placeholder="Enter your tenant name"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    The internal name for your workspace
                  </p>
                </div>

                {/* Organization Name */}
                <div className="group">
                  <label
                    htmlFor="org-name"
                    className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
                  >
                    Organization Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                    </div>
                    <input
                      type="text"
                      name="org-name"
                      id="org-name"
                      value={formData.organizationName}
                      onChange={(e) =>
                        handleInputChange('organizationName', e.target.value)
                      }
                      className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                               placeholder:text-gray-400 
                               hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                               focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50"
                      placeholder="Enter your organization name"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Your company or organization's public name
                  </p>
                </div>

                {/* Organization Website */}
                <div className="group">
                  <label
                    htmlFor="org-website"
                    className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
                  >
                    Organization Website
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                    </div>
                    <input
                      type="url"
                      name="org-website"
                      id="org-website"
                      value={formData.organizationWebsite}
                      onChange={(e) =>
                        handleInputChange('organizationWebsite', e.target.value)
                      }
                      className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                               placeholder:text-gray-400 
                               hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                               focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50"
                      placeholder="https://your-company.com"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Your organization's main website URL
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Brand Identity */}
          <BrandIdentity
            logo={formData.logo}
            brandColors={formData.brandColors}
            entityName={formData.organizationName}
            entityType="organization"
          />
        </div>

        {/* Right Column - AI Analysis */}
        <div className="space-y-6">
          {/* AI Summary */}
          <AIAnalysisSummary
            data={organization || {}}
            entityName={formData.organizationName}
            entityType="organization"
            isEditable={false}
            onResync={handleResync}
            isResyncing={resyncOrganizationMutation.isPending}
            formData={formData}
          />
        </div>
      </div>
    </div>
  )
}
