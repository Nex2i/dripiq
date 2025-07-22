import React, { useState } from 'react'
import {
  Users,
  User,
  Crown,
  Mail,
  Phone,
  Building,
  ExternalLink,
  CheckSquare,
  Square,
  Target,
  Loader2,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import CopyButton from '../CopyButton'
import LeadQualificationModal from '../LeadQualificationModal'
import type { LeadPointOfContact } from '../../types/lead.types'
import { getLeadsService } from '../../services/leads.service'

interface ContactsTabProps {
  contacts: LeadPointOfContact[]
  primaryContactId?: string
  leadId: string
  companyName?: string
}

const ContactsTab: React.FC<ContactsTabProps> = ({
  contacts,
  primaryContactId,
  leadId,
  companyName,
}) => {
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null)
  const [qualifyingContactId, setQualifyingContactId] = useState<string | null>(
    null,
  )
  const [qualificationModalOpen, setQualificationModalOpen] = useState(false)
  const [qualificationData, setQualificationData] = useState<any>(null)
  const [selectedContactName, setSelectedContactName] = useState<string>('')
  const leadsService = getLeadsService()

  const toggleManuallyReviewedMutation = useMutation({
    mutationFn: ({
      contactId,
      manuallyReviewed,
    }: {
      contactId: string
      manuallyReviewed: boolean
    }) =>
      leadsService.toggleContactManuallyReviewed(
        leadId,
        contactId,
        manuallyReviewed,
      ),
    onMutate: ({ contactId }) => {
      setLoadingContactId(contactId)
    },
    onSettled: () => {
      setLoadingContactId(null)
    },
    onError: (error) => {
      console.error('Failed to update manually reviewed status:', error)
      // You might want to show a toast notification here
    },
  })

  const qualifyContactMutation = useMutation({
    mutationFn: (contactId: string) =>
      leadsService.qualifyLeadContact(leadId, contactId),
    onMutate: (contactId) => {
      const contact = contacts.find((c) => c.id === contactId)
      if (contact) {
        setQualifyingContactId(contact.id)
        setSelectedContactName(contact.name)
      }
    },
    onSuccess: (result) => {
      setQualificationData(result.data)
      setQualificationModalOpen(true)
    },
    onSettled: () => {
      setQualifyingContactId(null)
    },
    onError: (error) => {
      console.error('Failed to generate lead qualification:', error)
      // You might want to show a toast notification here
    },
  })

  const handleToggleManuallyReviewed = (contact: LeadPointOfContact) => {
    toggleManuallyReviewedMutation.mutate({
      contactId: contact.id,
      manuallyReviewed: !contact.manuallyReviewed,
    })
  }

  const handleQualifyContact = (contactId: string) => {
    qualifyContactMutation.mutate(contactId)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Users className="h-5 w-5 text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Point of Contacts
          </h2>
        </div>

        {!contacts || contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg">No contacts associated with this lead.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {contact.name}
                    </h3>
                    <CopyButton
                      text={contact.name}
                      label="name"
                      className="ml-2"
                    />
                    {primaryContactId === contact.id && (
                      <div className="ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Crown className="h-3 w-3 mr-1" />
                        Primary
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleQualifyContact(contact.id)}
                      disabled={qualifyingContactId === contact.id}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Generate outreach strategy for this contact"
                    >
                      {qualifyingContactId === contact.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Target className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {qualifyingContactId === contact.id
                          ? 'Generating...'
                          : 'Generate Strategy'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleToggleManuallyReviewed(contact)}
                      disabled={loadingContactId === contact.id}
                      className="flex items-center space-x-2 px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        contact.manuallyReviewed
                          ? 'Mark as not manually reviewed'
                          : 'Mark as manually reviewed'
                      }
                    >
                      {loadingContactId === contact.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                      ) : contact.manuallyReviewed ? (
                        <CheckSquare className="h-4 w-4 text-green-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        Manually Reviewed
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Email
                        </p>
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
                          <p className="text-sm font-medium text-gray-900">
                            Phone
                          </p>
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
                        <p className="text-sm font-medium text-gray-900">
                          Title
                        </p>
                        <p className="text-base text-gray-700">
                          {contact.title}
                        </p>
                      </div>
                    </div>
                  )}

                  {contact.company && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Building className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Company
                        </p>
                        <p className="text-base text-gray-700">
                          {contact.company}
                        </p>
                      </div>
                    </div>
                  )}

                  {contact.sourceUrl && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <ExternalLink className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Source
                          </p>
                          <a
                            href={contact.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors underline"
                          >
                            View source page
                          </a>
                        </div>
                      </div>
                      <CopyButton text={contact.sourceUrl} label="source URL" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lead Qualification Modal */}
      <LeadQualificationModal
        isOpen={qualificationModalOpen}
        onClose={() => setQualificationModalOpen(false)}
        data={qualificationData}
        contactName={selectedContactName}
        companyName={companyName || 'Unknown Company'}
      />
    </div>
  )
}

export default ContactsTab
