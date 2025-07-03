import { useState, useEffect } from 'react'
import {
  Building,
  AlertCircle,
  Globe,
  Tag,
  RotateCcw,
  FileText,
  Package,
  Users,
  Lightbulb,
  Target,
  MessageCircle,
} from 'lucide-react'
import {
  useOrganization,
  useUpdateOrganization,
  useResyncOrganization,
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

  const handleArrayChange = (field: string, values: string[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: values,
    }))
    setIsDirty(true)
  }

  const addArrayItem = (field: string) => {
    const currentArray = formData[field as keyof typeof formData] as string[]
    setFormData((prev) => ({
      ...prev,
      [field]: [...currentArray, ''],
    }))
    setIsDirty(true)
  }

  const removeArrayItem = (field: string, index: number) => {
    const currentArray = formData[field as keyof typeof formData] as string[]
    const newArray = currentArray.filter((_, i) => i !== index)
    setFormData((prev) => ({
      ...prev,
      [field]: newArray,
    }))
    setIsDirty(true)
  }

  const updateArrayItem = (field: string, index: number, value: string) => {
    const currentArray = formData[field as keyof typeof formData] as string[]
    const newArray = [...currentArray]
    newArray[index] = value
    setFormData((prev) => ({
      ...prev,
      [field]: newArray,
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
        </div>
        <p className="text-gray-600">
          Manage your organization's core details and information.
        </p>
      </div>

      {/* Organization Details */}
      <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
        <div className="px-6 py-6">
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
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="https://your-company.com"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Your organization's main website URL
              </p>
            </div>

            {/* Summary */}
            <div className="group">
              <label
                htmlFor="summary"
                className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Summary
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="summary"
                  id="summary"
                  value={formData.summary}
                  onChange={(e) => handleInputChange('summary', e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter a brief summary of your organization"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                A concise description of your organization
              </p>
            </div>

            {/* Products */}
            <div className="group">
              <label
                htmlFor="products"
                className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Products
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Package className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="products"
                  id="products"
                  value={formData.products.join(', ')}
                  onChange={(e) =>
                    handleArrayChange(
                      'products',
                      e.target.value.split(',').map((p) => p.trim()),
                    )
                  }
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your products separated by commas"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                List your organization's products
              </p>
            </div>

            {/* Services */}
            <div className="group">
              <label
                htmlFor="services"
                className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Services
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Package className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="services"
                  id="services"
                  value={formData.services.join(', ')}
                  onChange={(e) =>
                    handleArrayChange(
                      'services',
                      e.target.value.split(',').map((s) => s.trim()),
                    )
                  }
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your services separated by commas"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                List your organization's services
              </p>
            </div>

            {/* Differentiators */}
            <div className="group">
              <label
                htmlFor="differentiators"
                className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Differentiators
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lightbulb className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="differentiators"
                  id="differentiators"
                  value={formData.differentiators.join(', ')}
                  onChange={(e) =>
                    handleArrayChange(
                      'differentiators',
                      e.target.value.split(',').map((d) => d.trim()),
                    )
                  }
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your differentiators separated by commas"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                List your organization's differentiators
              </p>
            </div>

            {/* Target Market */}
            <div className="group">
              <label
                htmlFor="target-market"
                className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Target Market
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Target className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="target-market"
                  id="target-market"
                  value={formData.targetMarket}
                  onChange={(e) =>
                    handleInputChange('targetMarket', e.target.value)
                  }
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your target market"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Describe your organization's target market
              </p>
            </div>

            {/* Tone */}
            <div className="group">
              <label
                htmlFor="tone"
                className="block text-sm font-semibold text-gray-800 mb-2 transition-colors group-focus-within:text-[var(--color-primary-600)]"
              >
                Tone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MessageCircle className="h-4 w-4 text-gray-400 transition-colors group-focus-within:text-[var(--color-primary-500)]" />
                </div>
                <input
                  type="text"
                  name="tone"
                  id="tone"
                  value={formData.tone}
                  onChange={(e) => handleInputChange('tone', e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-white/50 backdrop-blur-sm transition-all duration-200 ease-in-out
                           placeholder:text-gray-400 
                           hover:border-gray-300 hover:shadow-sm hover:bg-white/80
                           focus:outline-none focus:ring-0 focus:border-[var(--color-primary-500)] focus:bg-white focus:shadow-lg focus:shadow-[var(--color-primary-100)]/50
                           disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  placeholder="Enter your tone"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Describe your organization's tone
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
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
  )
}
