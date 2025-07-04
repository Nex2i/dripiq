import React, { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useLead, useResyncLead } from '../hooks/useLeadsQuery'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft,
  Edit,
  Globe,
  Mail,
  Phone,
  Building,
  Calendar,
  User,
  Crown,
  Users,
  RefreshCw,
  FileText,
  Package,
  Lightbulb,
  Target,
  MessageCircle,
} from 'lucide-react'

const LeadDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const { leadId } = useParams({ from: '/protected/leads/$leadId' })
  const { data: lead, isLoading, error } = useLead(leadId)
  const resyncLead = useResyncLead()
  const [resyncMessage, setResyncMessage] = useState<string | null>(null)

  const handleBack = () => {
    navigate({ to: '/leads' })
  }

  const handleResync = () => {
    if (!lead?.id) return

    setResyncMessage(null)

    resyncLead.mutate(lead.id, {
      onSuccess: (result) => {
        setResyncMessage(result.message)

        // Clear the message after 3 seconds
        setTimeout(() => {
          setResyncMessage(null)
        }, 3000)
      },
      onError: (error) => {
        console.error('Error resyncing lead:', error)
        setResyncMessage('Failed to resync lead')

        // Clear the message after 3 seconds
        setTimeout(() => {
          setResyncMessage(null)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{lead.name}</h1>
              <p className="mt-2 text-gray-600">Lead Details</p>
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
                onClick={() => {
                  // TODO: Navigate to edit page when implemented
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

        {/* Resync Message */}
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

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Manual Input Details */}
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Basic Information
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Lead Name
                      </p>
                      <p className="text-sm text-gray-500">{lead.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Website
                      </p>
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

                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Created
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(lead.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Last Updated
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(lead.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Point of Contacts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <Users className="h-5 w-5 text-gray-400 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Point of Contacts
                  </h2>
                </div>

                {!lead.pointOfContacts || lead.pointOfContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No contacts associated with this lead.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lead.pointOfContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <h3 className="text-sm font-medium text-gray-900">
                              {contact.name}
                            </h3>
                            {lead.primaryContactId === contact.id && (
                              <div className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Crown className="h-3 w-3 mr-1" />
                                Primary
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center space-x-3">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-xs font-medium text-gray-900">
                                Email
                              </p>
                              <a
                                href={`mailto:${contact.email}`}
                                className="text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                              >
                                {contact.email}
                              </a>
                            </div>
                          </div>

                          {contact.phone && (
                            <div className="flex items-center space-x-3">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs font-medium text-gray-900">
                                  Phone
                                </p>
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="text-sm text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                                >
                                  {contact.phone}
                                </a>
                              </div>
                            </div>
                          )}

                          {contact.title && (
                            <div className="flex items-center space-x-3">
                              <User className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs font-medium text-gray-900">
                                  Title
                                </p>
                                <p className="text-sm text-gray-500">
                                  {contact.title}
                                </p>
                              </div>
                            </div>
                          )}

                          {contact.company && (
                            <div className="flex items-center space-x-3">
                              <Building className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-xs font-medium text-gray-900">
                                  Company
                                </p>
                                <p className="text-sm text-gray-500">
                                  {contact.company}
                                </p>
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
          </div>

          {/* Right Column - AI Summary Details */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl border border-gray-100/50">
              <div className="px-6 py-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  AI Summary
                </h2>
                <div className="space-y-5">
                  {/* Summary */}
                  {lead.summary && (
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Summary
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                          <FileText className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm text-gray-700 cursor-default overflow-y-auto min-h-[200px] max-h-[400px]">
                          <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-headings:font-semibold prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-800 prose-strong:font-semibold prose-em:text-gray-600 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-code:text-gray-800 prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-300 prose-blockquote:text-gray-600 prose-blockquote:border-gray-300 prose-hr:border-gray-300">
                            <ReactMarkdown>{lead.summary}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        A concise description of the lead's organization
                      </p>
                    </div>
                  )}

                  {/* Products */}
                  {lead.products && lead.products.length > 0 && (
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Products
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
                          <Package className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm min-h-[42px]">
                          <ul className="space-y-1 text-gray-700">
                            {lead.products.map((product, index) => (
                              <li key={index} className="flex items-center">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                                {product}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        List of the lead's products
                      </p>
                    </div>
                  )}

                  {/* Services */}
                  {lead.services && lead.services.length > 0 && (
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Services
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
                          <Package className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm min-h-[42px]">
                          <ul className="space-y-1 text-gray-700">
                            {lead.services.map((service, index) => (
                              <li key={index} className="flex items-center">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                                {service}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        List of the lead's services
                      </p>
                    </div>
                  )}

                  {/* Differentiators */}
                  {lead.differentiators && lead.differentiators.length > 0 && (
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Differentiators
                      </label>
                      <div className="relative">
                        <div className="absolute top-3 left-0 pl-3 flex items-center pointer-events-none">
                          <Lightbulb className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm min-h-[42px]">
                          <ul className="space-y-1 text-gray-700">
                            {lead.differentiators.map(
                              (differentiator, index) => (
                                <li key={index} className="flex items-center">
                                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2 flex-shrink-0"></span>
                                  {differentiator}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        List of the lead's differentiators
                      </p>
                    </div>
                  )}

                  {/* Target Market */}
                  {lead.targetMarket && (
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Target Market
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Target className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm text-gray-700 cursor-default">
                          {lead.targetMarket}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        The lead's target market
                      </p>
                    </div>
                  )}

                  {/* Tone */}
                  {lead.tone && (
                    <div className="group">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        Tone
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MessageCircle className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="block w-full pl-10 pr-3 py-2.5 text-sm border-2 border-gray-200 rounded-xl bg-gray-50 backdrop-blur-sm text-gray-700 cursor-default">
                          {lead.tone}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        The lead's tone
                      </p>
                    </div>
                  )}

                  {/* Empty State for AI Summary */}
                  {!lead.summary &&
                    (!lead.products || lead.products.length === 0) &&
                    (!lead.services || lead.services.length === 0) &&
                    (!lead.differentiators ||
                      lead.differentiators.length === 0) &&
                    !lead.targetMarket &&
                    !lead.tone && (
                      <div className="text-center py-12 text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          No AI Summary Available
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Run a resync to generate AI insights for this lead.
                        </p>
                        <button
                          onClick={handleResync}
                          disabled={resyncLead.isPending}
                          className="inline-flex items-center px-4 py-2 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw
                            className={`h-4 w-4 mr-2 ${resyncLead.isPending ? 'animate-spin' : ''}`}
                          />
                          {resyncLead.isPending
                            ? 'Resyncing...'
                            : 'Generate AI Summary'}
                        </button>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Additional Information
            </h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                This lead was created on {formatDate(lead.createdAt)} and is
                currently in "{lead.status}" status.
                {lead.pointOfContacts &&
                  lead.pointOfContacts.length > 0 &&
                  ` It has ${lead.pointOfContacts.length} associated contact${lead.pointOfContacts.length > 1 ? 's' : ''}.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LeadDetailPage
