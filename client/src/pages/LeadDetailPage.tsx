import React, { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  useLead,
  useResyncLead,
  useVendorFitLead,
} from '../hooks/useLeadsQuery'
import {
  ArrowLeft,
  Edit,
  Globe,
  Mail,
  Phone,
  Building,
  User,
  Crown,
  Users,
  RefreshCw,
  Info,
  Palette,
  Brain,
} from 'lucide-react'
import AIAnalysisSummary from '../components/AIAnalysisSummary'
import BrandIdentity from '../components/BrandIdentity'
import VendorFitModal from '../components/VendorFitModal'
import Tabs from '../components/Tabs'
import CopyButton from '../components/CopyButton'
import Tooltip from '../components/Tooltip'

const LeadDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { leadId } = useParams({ from: '/protected/leads/$leadId' })
  const { data: lead, isLoading, error } = useLead(leadId)
  const resyncLead = useResyncLead()
  const vendorFitLead = useVendorFitLead()
  const [resyncMessage, setResyncMessage] = useState<string | null>(null)
  const [vendorFitMessage, setVendorFitMessage] = useState<string | null>(null)
  const [vendorFitModalOpen, setVendorFitModalOpen] = useState(false)
  const [vendorFitData, setVendorFitData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('basic')

  const handleBack = () => {
    navigate({ to: '/leads' })
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

  const getStatusBadge = (status: string) => {
    const statusColors = {
      new: 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]',
      contacted: 'bg-yellow-100 text-yellow-800',
      qualified: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
    }

    const displayStatus = status || 'new'

    return (
      <span
        className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[displayStatus as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}
      >
        {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
      </span>
    )
  }

  const tabs = [
    {
      id: 'basic',
      label: 'Basic Info',
      icon: <Info />,
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: <Users />,
    },
    {
      id: 'branding',
      label: 'Branding',
      icon: <Palette />,
    },
    {
      id: 'ai-details',
      label: 'AI Details',
      icon: <Brain />,
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
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
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

  const renderBasicInfo = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Basic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Status</p>
                <div className="mt-1">{getStatusBadge(lead.status)}</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Globe className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Website</p>
                <a
                  href={lead.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                >
                  {lead.url}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContacts = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Point of Contacts
          </h2>
        </div>

        {!lead.pointOfContacts || lead.pointOfContacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg">No contacts associated with this lead.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {lead.pointOfContacts.map((contact) => (
              <div
                key={contact.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {contact.name}
                    </h3>
                    <CopyButton text={contact.name} label="name" className="ml-2" />
                    {lead.primaryContactId === contact.id && (
                      <div className="ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Crown className="h-3 w-3 mr-1" />
                        Primary
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                        >
                          {contact.email}
                        </a>
                      </div>
                    </div>
                    <CopyButton text={contact.email} label="email" />
                  </div>

                  {contact.phone && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Phone</p>
                          <a
                            href={`tel:${contact.phone}`}
                            className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                          >
                            {contact.phone}
                          </a>
                        </div>
                      </div>
                      <CopyButton text={contact.phone} label="phone" />
                    </div>
                  )}

                  {contact.title && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Title</p>
                        <p className="text-base text-gray-700">{contact.title}</p>
                      </div>
                    </div>
                  )}

                  {contact.company && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Building className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Company</p>
                        <p className="text-base text-gray-700">{contact.company}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderBranding = () => (
    <BrandIdentity
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

  const renderAIDetails = () => (
    <AIAnalysisSummary
      data={lead}
      entityName={lead.name}
      entityType="lead"
      isEditable={false}
      onResync={handleResync}
      isResyncing={resyncLead.isPending}
    />
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicInfo()
      case 'contacts':
        return renderContacts()
      case 'branding':
        return renderBranding()
      case 'ai-details':
        return renderAIDetails()
      default:
        return renderBasicInfo()
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
          <div className="flex justify-between items-start">
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
                      <span className="text-lg">{lead.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                    </a>
                  )}
                </div>
                <p className="mt-2 text-gray-600">Lead Details</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {getStatusBadge(lead.status)}
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
              <button
                onClick={() => {
                  console.log('Edit lead:', lead.id)
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
            </div>
          </div>
        </div>

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
