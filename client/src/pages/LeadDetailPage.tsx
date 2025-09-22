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
  Users,
  Info,
  Palette,
  Brain,
  Package,
  AlertCircle,
} from 'lucide-react'
import VendorFitModal from '../components/VendorFitModal'
import Tabs from '../components/Tabs'
import ContactsTab from '../components/tabs/ContactsTab'
import AIDetailsTab from '../components/tabs/AIDetailsTab'
import BrandingTab from '../components/tabs/BrandingTab'
import LeadDetailsTab from '../components/tabs/LeadDetailsTab'
import ProductsTab from '../components/tabs/ProductsTab'
import LeadProcessingBanner from '../components/LeadProcessingBanner'
import LeadViewHeader from '../components/LeadViewHeader'
import LeadEditForm from '../components/LeadEditForm'
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
    // Scroll to top after switching back to view mode
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth'
      })
    }, 100)
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
          // Set success message immediately
          setUpdateMessage('Lead updated successfully')
          
          // Small delay to ensure React Query cache is updated, then switch to view mode
          setTimeout(() => {
            setIsEditing(false)
            
            // Scroll to top after switching back to view mode
            setTimeout(() => {
              window.scrollTo({
                top: 0,
                left: 0,
                behavior: 'smooth'
              })
            }, 100)
          }, 50)
          
          // Clear success message after 3 seconds
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
          {!isEditing ? (
            <LeadViewHeader
              lead={lead}
              formatDate={formatDate}
              onResync={handleResync}
              onVendorFit={handleVendorFit}
              onStartEdit={handleStartEdit}
              isResyncing={resyncLead.isPending}
              isVendorFitting={vendorFitLead.isPending}
            />
          ) : (
            <LeadEditForm
              editForm={editForm}
              setEditForm={setEditForm}
              validationErrors={validationErrors}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
              isSaving={updateLead.isPending}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
              updateArrayItem={updateArrayItem}
            />
          )}
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
