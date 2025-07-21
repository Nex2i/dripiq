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
  Users,
  RefreshCw,
  Info,
  Palette,
  Brain,
} from 'lucide-react'
import VendorFitModal from '../components/VendorFitModal'
import Tabs from '../components/Tabs'
import Tooltip from '../components/Tooltip'
import ContactsTab from '../components/tabs/ContactsTab'
import AIDetailsTab from '../components/tabs/AIDetailsTab'
import BrandingTab from '../components/tabs/BrandingTab'
import LeadDetailsTab from '../components/tabs/LeadDetailsTab'
import LeadStatusBadges from '../components/LeadStatusBadges'

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
  const [activeTab, setActiveTab] = useState('contacts')

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
      id: 'contacts',
      label: 'Contacts',
      icon: <Users />,
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contacts':
        return (
          <ContactsTab
            contacts={lead.pointOfContacts || []}
            primaryContactId={lead.primaryContactId}
            leadId={leadId}
          />
        )
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
                <div className="mt-3">
                  <LeadStatusBadges statuses={lead.statuses || []} />
                </div>
                <p className="mt-2 text-gray-600">Lead Details</p>
              </div>
            </div>
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
