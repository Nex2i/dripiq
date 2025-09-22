import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  useLead,
  useResyncLead,
  useVendorFitLead,
  useUpdateLead,
} from '../hooks/useLeadsQuery'
import {
  ArrowLeft,
  Edit,
  Globe,
  Users,
  RefreshCw,
  Info,
  Palette,
  Brain,
  Package,
  AlertCircle,
  Save,
  X,
  Plus,
  Trash2,
} from 'lucide-react'
import VendorFitModal from '../components/VendorFitModal'
import Tabs from '../components/Tabs'
import Tooltip from '../components/Tooltip'
import ContactsTab from '../components/tabs/ContactsTab'
import AIDetailsTab from '../components/tabs/AIDetailsTab'
import BrandingTab from '../components/tabs/BrandingTab'
import LeadDetailsTab from '../components/tabs/LeadDetailsTab'
import ProductsTab from '../components/tabs/ProductsTab'
import LeadStatusBadges from '../components/LeadStatusBadges'
import LeadProcessingBanner from '../components/LeadProcessingBanner'
import { HOME_URL } from '../constants/navigation'
import type { UpdateLeadData } from '../services/leads.service'

const LeadDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { leadId } = useParams({ from: '/protected/leads/$leadId' })
  const { data: lead, isLoading, error } = useLead(leadId)
  const resyncLead = useResyncLead()
  const vendorFitLead = useVendorFitLead()
  const updateLead = useUpdateLead()
  const [resyncMessage, setResyncMessage] = useState<string | null>(null)
  const [vendorFitMessage, setVendorFitMessage] = useState<string | null>(null)
  const [vendorFitModalOpen, setVendorFitModalOpen] = useState(false)
  const [vendorFitData, setVendorFitData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('contacts')
  
  // Edit state management
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<UpdateLeadData>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const handleBack = () => {
    navigate({ to: HOME_URL })
  }

  // Initialize edit form when lead data is available
  useEffect(() => {
    if (lead && !isEditing) {
      setEditForm({
        name: lead.name || '',
        url: lead.url || '',
        status: lead.status || '',
        summary: lead.summary || '',
        products: lead.products || [],
        services: lead.services || [],
        differentiators: lead.differentiators || [],
        targetMarket: lead.targetMarket || '',
        tone: lead.tone || '',
        brandColors: lead.brandColors || [],
      })
    }
  }, [lead, isEditing])

  const handleStartEdit = () => {
    if (lead) {
      setEditForm({
        name: lead.name || '',
        url: lead.url || '',
        status: lead.status || '',
        summary: lead.summary || '',
        products: lead.products || [],
        services: lead.services || [],
        differentiators: lead.differentiators || [],
        targetMarket: lead.targetMarket || '',
        tone: lead.tone || '',
        brandColors: lead.brandColors || [],
      })
      setValidationErrors({})
      setUpdateMessage(null)
      setIsEditing(true)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({})
    setValidationErrors({})
    setUpdateMessage(null)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!editForm.name?.trim()) {
      errors.name = 'Name is required'
    }

    if (!editForm.url?.trim()) {
      errors.url = 'URL is required'
    } else {
      try {
        new URL(editForm.url)
      } catch {
        errors.url = 'Invalid URL format'
      }
    }

    if (editForm.brandColors) {
      const invalidColors = editForm.brandColors.filter(
        (color) => !/^#[0-9A-Fa-f]{6}$/.test(color)
      )
      if (invalidColors.length > 0) {
        errors.brandColors = 'All brand colors must be valid hex codes (e.g., #FF0000)'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveEdit = () => {
    if (!lead?.id || !validateForm()) return

    const changedFields: UpdateLeadData = {}

    // Only include changed fields
    if (editForm.name !== lead.name) changedFields.name = editForm.name
    if (editForm.url !== lead.url) changedFields.url = editForm.url
    if (editForm.status !== lead.status) changedFields.status = editForm.status
    if (editForm.summary !== lead.summary) changedFields.summary = editForm.summary
    if (editForm.targetMarket !== lead.targetMarket) changedFields.targetMarket = editForm.targetMarket
    if (editForm.tone !== lead.tone) changedFields.tone = editForm.tone
    
    // For arrays, check for changes
    if (JSON.stringify(editForm.products) !== JSON.stringify(lead.products)) {
      changedFields.products = editForm.products
    }
    if (JSON.stringify(editForm.services) !== JSON.stringify(lead.services)) {
      changedFields.services = editForm.services
    }
    if (JSON.stringify(editForm.differentiators) !== JSON.stringify(lead.differentiators)) {
      changedFields.differentiators = editForm.differentiators
    }
    if (JSON.stringify(editForm.brandColors) !== JSON.stringify(lead.brandColors)) {
      changedFields.brandColors = editForm.brandColors
    }

    if (Object.keys(changedFields).length === 0) {
      setUpdateMessage('No changes to save')
      setTimeout(() => setUpdateMessage(null), 3000)
      return
    }

    updateLead.mutate(
      { id: lead.id, data: changedFields },
      {
        onSuccess: () => {
          setIsEditing(false)
          setUpdateMessage('Lead updated successfully')
          setTimeout(() => setUpdateMessage(null), 3000)
        },
        onError: (error) => {
          setUpdateMessage('Failed to update lead')
          console.error('Error updating lead:', error)
          setTimeout(() => setUpdateMessage(null), 3000)
        },
      }
    )
  }

  // Array field helpers
  const addArrayItem = (field: keyof UpdateLeadData, value: string) => {
    if (!value.trim()) return
    const currentArray = (editForm[field] as string[]) || []
    if (!currentArray.includes(value.trim())) {
      setEditForm(prev => ({
        ...prev,
        [field]: [...currentArray, value.trim()]
      }))
    }
  }

  const removeArrayItem = (field: keyof UpdateLeadData, index: number) => {
    const currentArray = (editForm[field] as string[]) || []
    setEditForm(prev => ({
      ...prev,
      [field]: currentArray.filter((_, i) => i !== index)
    }))
  }

  const updateArrayItem = (field: keyof UpdateLeadData, index: number, value: string) => {
    const currentArray = (editForm[field] as string[]) || []
    const newArray = [...currentArray]
    newArray[index] = value
    setEditForm(prev => ({
      ...prev,
      [field]: newArray
    }))
  }

  const handleResync = () => {
    if (!lead?.id) return

    setResyncMessage(null)

    resyncLead.mutate(lead.id, {
      onSuccess: (result) => {
        setResyncMessage(result.message)
        setTimeout(() => {
          setResyncMessage(null)
        }, 3000)
      },
      onError: (error) => {
        console.error('Error resyncing lead:', error)
        setResyncMessage('Failed to resync lead')
        setTimeout(() => {
          setResyncMessage(null)
        }, 3000)
      },
    })
  }

  const handleVendorFit = () => {
    if (!lead?.id) return

    setVendorFitMessage(null)

    vendorFitLead.mutate(lead.id, {
      onSuccess: (result) => {
        setVendorFitMessage(result.message || 'Vendor fit completed')
        setVendorFitData(result)
        setVendorFitModalOpen(true)
        setTimeout(() => {
          setVendorFitMessage(null)
        }, 3000)
      },
      onError: (error) => {
        console.error('Error running vendor fit:', error)
        setVendorFitMessage('Failed to run vendor fit')
        setTimeout(() => {
          setVendorFitMessage(null)
        }, 3000)
      },
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const tabs = [
    {
      id: 'contacts',
      label: 'Contacts',
      icon: <Users />,
    },
    {
      id: 'products',
      label: 'Products',
      icon: <Package />,
    },
    {
      id: 'ai-details',
      label: 'AI Details',
      icon: <Brain />,
    },
    {
      id: 'branding',
      label: 'Branding',
      icon: <Palette />,
    },
    {
      id: 'lead-details',
      label: 'Lead Details',
      icon: <Info />,
    },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary-600)] mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading lead details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 text-red-500">
                <AlertCircle className="w-12 h-12" />
              </div>
              <p className="text-gray-900 font-medium mb-2">
                Error loading lead
              </p>
              <p className="text-gray-500 mb-4">
                {error?.message || String(error)}
              </p>
              <button
                onClick={handleBack}
                className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Back to Leads
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-8 text-center">
              <p className="text-gray-500">Lead not found</p>
              <button
                onClick={handleBack}
                className="mt-4 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Back to Leads
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contacts':
        return (
          <ContactsTab
            contacts={lead.pointOfContacts || []}
            primaryContactId={lead.primaryContactId}
            leadId={leadId}
            companyName={lead.name}
          />
        )
      case 'products':
        return <ProductsTab leadId={leadId} />
      case 'ai-details':
        return (
          <AIDetailsTab
            data={lead}
            entityName={lead.name}
            entityType="lead"
            onResync={handleResync}
            isResyncing={resyncLead.isPending}
          />
        )
      case 'branding':
        return (
          <BrandingTab
            logo={lead.logo}
            brandColors={lead.brandColors}
            entityName={lead.name}
            entityType="lead"
            entityWebsite={lead.url}
            onBrandColorsUpdate={(newBrandColors) => {
              console.log('newBrandColors', newBrandColors)
            }}
          />
        )
      case 'lead-details':
        return (
          <LeadDetailsTab
            status={lead.status}
            url={lead.url}
            statuses={lead.statuses}
          />
        )
      default:
        return (
          <ContactsTab
            contacts={lead.pointOfContacts || []}
            primaryContactId={lead.primaryContactId}
            leadId={leadId}
            companyName={lead.name}
          />
        )
    }
  }

  // Array Field Editor Component
  const ArrayFieldEditor: React.FC<{
    label: string
    items: string[]
    onAdd: (value: string) => void
    onRemove: (index: number) => void
    onUpdate: (index: number, value: string) => void
    placeholder: string
  }> = ({ label, items, onAdd, onRemove, onUpdate, placeholder }) => {
    const [newItem, setNewItem] = useState('')

    const handleAdd = () => {
      if (newItem.trim()) {
        onAdd(newItem.trim())
        setNewItem('')
      }
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={item}
                onChange={(e) => onUpdate(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-2 text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={handleAdd}
              className="p-2 text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Color Array Field Editor Component
  const ColorArrayFieldEditor: React.FC<{
    label: string
    items: string[]
    onAdd: (value: string) => void
    onRemove: (index: number) => void
    onUpdate: (index: number, value: string) => void
    error?: string
  }> = ({ label, items, onAdd, onRemove, onUpdate, error }) => {
    const [newColor, setNewColor] = useState('#000000')

    const handleAdd = () => {
      if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
        onAdd(newColor)
        setNewColor('#000000')
      }
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        <div className="space-y-2">
          {items.map((color, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: color }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => onUpdate(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                pattern="^#[0-9A-Fa-f]{6}$"
                placeholder="#000000"
              />
              <input
                type="color"
                value={color}
                onChange={(e) => onUpdate(index, e.target.value)}
                className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-2 text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <div
              className="w-8 h-8 rounded border border-gray-300"
              style={{ backgroundColor: newColor }}
            />
            <input
              type="text"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
              pattern="^#[0-9A-Fa-f]{6}$"
              placeholder="#000000"
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="p-2 text-[var(--color-primary-600)] hover:text-[var(--color-primary-800)]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-1">{error}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </button>
          <div className="flex justify-between items-start">
            {!isEditing ? (
              <div className="flex items-center space-x-4">
                <div>
                  <div className="flex items-center space-x-3">
                    <Tooltip
                      content={
                        <div className="text-left">
                          <div>Created: {formatDate(lead.createdAt)}</div>
                          <div>Updated: {formatDate(lead.updatedAt)}</div>
                        </div>
                      }
                    >
                      <h1 className="text-3xl font-bold text-gray-900 cursor-help">
                        {lead.name}
                      </h1>
                    </Tooltip>
                    {lead.url && (
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                      >
                        <Globe className="h-5 w-5 mr-1" />
                        <span className="text-lg">
                          {lead.url
                            .replace(/^https?:\/\//, '')
                            .replace(/\/$/, '')}
                        </span>
                      </a>
                    )}
                  </div>
                  <div className="mt-3">
                    <LeadStatusBadges statuses={lead.statuses || []} />
                  </div>
                  <p className="mt-2 text-gray-600">Lead Details</p>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Lead</h1>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Information */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] ${
                          validationErrors.name ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Lead name"
                      />
                      {validationErrors.name && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL *
                      </label>
                      <input
                        type="url"
                        value={editForm.url || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] ${
                          validationErrors.url ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="https://example.com"
                      />
                      {validationErrors.url && (
                        <p className="text-red-600 text-sm mt-1">{validationErrors.url}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={editForm.status || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Market
                      </label>
                      <input
                        type="text"
                        value={editForm.targetMarket || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, targetMarket: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                        placeholder="Target market"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Summary
                      </label>
                      <textarea
                        value={editForm.summary || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, summary: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                        placeholder="Lead summary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tone
                      </label>
                      <input
                        type="text"
                        value={editForm.tone || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, tone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)]"
                        placeholder="Company tone"
                      />
                    </div>

                    {/* Array Fields */}
                    <div className="md:col-span-2">
                      <ArrayFieldEditor
                        label="Products"
                        items={editForm.products || []}
                        onAdd={(value) => addArrayItem('products', value)}
                        onRemove={(index) => removeArrayItem('products', index)}
                        onUpdate={(index, value) => updateArrayItem('products', index, value)}
                        placeholder="Add product"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <ArrayFieldEditor
                        label="Services"
                        items={editForm.services || []}
                        onAdd={(value) => addArrayItem('services', value)}
                        onRemove={(index) => removeArrayItem('services', index)}
                        onUpdate={(index, value) => updateArrayItem('services', index, value)}
                        placeholder="Add service"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <ArrayFieldEditor
                        label="Differentiators"
                        items={editForm.differentiators || []}
                        onAdd={(value) => addArrayItem('differentiators', value)}
                        onRemove={(index) => removeArrayItem('differentiators', index)}
                        onUpdate={(index, value) => updateArrayItem('differentiators', index, value)}
                        placeholder="Add differentiator"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <ColorArrayFieldEditor
                        label="Brand Colors"
                        items={editForm.brandColors || []}
                        onAdd={(value) => addArrayItem('brandColors', value)}
                        onRemove={(index) => removeArrayItem('brandColors', index)}
                        onUpdate={(index, value) => updateArrayItem('brandColors', index, value)}
                        error={validationErrors.brandColors}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <button
                onClick={handleResync}
                disabled={resyncLead.isPending}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${resyncLead.isPending ? 'animate-spin' : ''}`}
                />
                {resyncLead.isPending ? 'Resyncing...' : 'Resync'}
              </button>
              <button
                onClick={handleVendorFit}
                disabled={vendorFitLead.isPending}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users
                  className={`h-4 w-4 mr-2 ${vendorFitLead.isPending ? 'animate-spin' : ''}`}
                />
                {vendorFitLead.isPending ? 'Running...' : 'Vendor Fit'}
              </button>
              {!isEditing ? (
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveEdit}
                    disabled={updateLead.isPending}
                    className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className={`h-4 w-4 mr-2 ${updateLead.isPending ? 'animate-spin' : ''}`} />
                    {updateLead.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Processing Status Banner */}
        <LeadProcessingBanner
          leadId={leadId}
          statuses={lead.statuses || []}
          className="mb-6"
        />

        {/* Messages */}
        {resyncMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              resyncMessage.includes('Failed') ||
              resyncMessage.includes('Error')
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            <p className="text-sm font-medium">{resyncMessage}</p>
          </div>
        )}

        {vendorFitMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              vendorFitMessage.includes('Failed') ||
              vendorFitMessage.includes('Error')
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            <p className="text-sm font-medium">{vendorFitMessage}</p>
          </div>
        )}

        {updateMessage && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              updateMessage.includes('Failed') ||
              updateMessage.includes('Error') ||
              updateMessage.includes('No changes')
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-green-50 border-green-200 text-green-700'
            }`}
          >
            <p className="text-sm font-medium">{updateMessage}</p>
          </div>
        )}

        {/* Tabs */}
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
          {renderTabContent()}
        </Tabs>

        {/* Vendor Fit Modal */}
        <VendorFitModal
          isOpen={vendorFitModalOpen}
          onClose={() => setVendorFitModalOpen(false)}
          data={vendorFitData}
        />
      </div>
    </div>
  )
}

export default LeadDetailPage
