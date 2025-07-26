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
  Edit3,
  Save,
  X,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import CopyButton from '../CopyButton'
import LeadQualificationModal from '../LeadQualificationModal'
import type { LeadPointOfContact } from '../../types/lead.types'
import { getLeadsService } from '../../services/leads.service'
import { useUpdateContact, useToggleContactManuallyReviewed } from '../../hooks/useLeadsQuery'

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
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<LeadPointOfContact>>({})
  const [originalFormData, setOriginalFormData] = useState<Partial<LeadPointOfContact>>({})
  const leadsService = getLeadsService()
  
  const updateContactMutation = useUpdateContact(
    // onSuccess callback
    () => {
      handleCancelEdit()
    },
    // onError callback
    (error) => {
      console.error('Failed to update contact:', error)
      // You might want to show a toast notification here
    }
  )

  const toggleManuallyReviewedMutation = useToggleContactManuallyReviewed()

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
    setLoadingContactId(contact.id)
    toggleManuallyReviewedMutation.mutate({
      leadId,
      contactId: contact.id,
      manuallyReviewed: !contact.manuallyReviewed,
    }, {
      onSettled: () => {
        setLoadingContactId(null)
      }
    })
  }

  const handleQualifyContact = (contactId: string) => {
    qualifyContactMutation.mutate(contactId)
  }

  const handleEditContact = (contact: LeadPointOfContact) => {
    const editableData = {
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      title: contact.title || '',
    }
    setEditingContactId(contact.id)
    setEditFormData(editableData)
    setOriginalFormData(editableData)
    
    // Auto-focus the name input after the component re-renders
    setTimeout(() => {
      const nameInput = document.querySelector(`input[data-field="name-${contact.id}"]`) as HTMLInputElement;
      if (nameInput) nameInput.focus();
    }, 0)
  }

  const handleCancelEdit = () => {
    setEditingContactId(null)
    setEditFormData({})
    setOriginalFormData({})
  }

  const handleFormChange = (field: keyof LeadPointOfContact, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSaveContact = () => {
    if (!editingContactId) return

    // Validate required fields
    if (!editFormData.name?.trim()) {
      // You might want to show a toast notification here
      console.error('Contact name is required')
      return
    }

    if (!editFormData.email?.trim()) {
      // You might want to show a toast notification here
      console.error('Contact email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editFormData.email)) {
      // You might want to show a toast notification here
      console.error('Invalid email format')
      return
    }

    // Prepare data for update (only changed fields)
    const updateData: any = {}
    
    if (editFormData.name !== originalFormData.name) {
      updateData.name = editFormData.name
    }
    if (editFormData.email !== originalFormData.email) {
      updateData.email = editFormData.email
    }
    if (editFormData.phone !== originalFormData.phone) {
      updateData.phone = editFormData.phone || null
    }
    if (editFormData.title !== originalFormData.title) {
      updateData.title = editFormData.title || null
    }

    // Only make API call if there are changes
    if (Object.keys(updateData).length > 0) {
      updateContactMutation.mutate({
        leadId,
        contactId: editingContactId,
        contactData: updateData,
      })
    } else {
      // No changes, just exit edit mode
      handleCancelEdit()
    }
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
                    {editingContactId === contact.id ? (
                      <div 
                        className="flex items-center space-x-2 cursor-text"
                        onClick={() => {
                          const nameInput = document.querySelector(`input[data-field="name-${contact.id}"]`) as HTMLInputElement;
                          if (nameInput) nameInput.focus();
                        }}
                      >
                        <input
                          type="text"
                          data-field={`name-${contact.id}`}
                          value={editFormData.name || ''}
                          onChange={(e) => handleFormChange('name', e.target.value)}
                          className="text-lg font-medium text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400 min-w-0 flex-1"
                          placeholder="Contact name"
                          required
                        />
                        {primaryContactId === contact.id && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Crown className="h-3 w-3 mr-1" />
                            Primary
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {editingContactId === contact.id ? (
                      <>
                        <button
                          onClick={handleSaveContact}
                          disabled={updateContactMutation.isPending}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Save changes"
                        >
                          {updateContactMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">
                            {updateContactMutation.isPending ? 'Saving...' : 'Save'}
                          </span>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={updateContactMutation.isPending}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cancel editing"
                        >
                          <X className="h-4 w-4" />
                          <span className="text-sm font-medium">Cancel</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditContact(contact)}
                          disabled={editingContactId !== null || qualifyingContactId === contact.id || loadingContactId === contact.id}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit contact"
                        >
                          <Edit3 className="h-4 w-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>
                        <button
                          onClick={() => handleQualifyContact(contact.id)}
                          disabled={qualifyingContactId === contact.id || editingContactId !== null}
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
                          disabled={loadingContactId === contact.id || editingContactId !== null || toggleManuallyReviewedMutation.isPending}
                          className="flex items-center space-x-2 px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            contact.manuallyReviewed
                              ? 'Mark as not manually reviewed'
                              : 'Mark as manually reviewed'
                          }
                        >
                          {(loadingContactId === contact.id || toggleManuallyReviewedMutation.isPending) ? (
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
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <div 
                     className={`p-3 bg-gray-50 rounded-lg ${editingContactId === contact.id ? 'cursor-text hover:bg-gray-100 transition-colors' : 'flex items-center justify-between'}`}
                     onClick={() => {
                       if (editingContactId === contact.id) {
                         const emailInput = document.querySelector(`input[data-field="email-${contact.id}"]`) as HTMLInputElement;
                         if (emailInput) emailInput.focus();
                       }
                     }}
                  >
                    {editingContactId === contact.id ? (
                      <div className="w-full">
                        <div className="flex items-center space-x-3 mb-2">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <p className="text-sm font-medium text-gray-900">Email</p>
                        </div>
                        <input
                          type="email"
                          data-field={`email-${contact.id}`}
                          value={editFormData.email || ''}
                          onChange={(e) => handleFormChange('email', e.target.value)}
                          className="w-full text-base text-[var(--color-primary-600)] bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400"
                          placeholder="Contact email"
                          required
                        />
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>

                  {(contact.phone || editingContactId === contact.id) && (
                                         <div 
                       className={`p-3 bg-gray-50 rounded-lg ${editingContactId === contact.id ? 'cursor-text hover:bg-gray-100 transition-colors' : 'flex items-center justify-between'}`}
                       onClick={() => {
                         if (editingContactId === contact.id) {
                           const phoneInput = document.querySelector(`input[data-field="phone-${contact.id}"]`) as HTMLInputElement;
                           if (phoneInput) phoneInput.focus();
                         }
                       }}
                    >
                      {editingContactId === contact.id ? (
                        <div className="w-full">
                          <div className="flex items-center space-x-3 mb-2">
                            <Phone className="h-5 w-5 text-gray-400" />
                            <p className="text-sm font-medium text-gray-900">Phone</p>
                          </div>
                          <input
                            type="tel"
                            data-field={`phone-${contact.id}`}
                            value={editFormData.phone || ''}
                            onChange={(e) => handleFormChange('phone', e.target.value)}
                            className="w-full text-base text-[var(--color-primary-600)] bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400"
                            placeholder="Contact phone"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center space-x-3">
                            <Phone className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Phone
                              </p>
                              {contact.phone ? (
                                <a
                                  href={`tel:${contact.phone}`}
                                  className="text-base text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] transition-colors"
                                >
                                  {contact.phone}
                                </a>
                              ) : (
                                <span className="text-base text-gray-500">No phone</span>
                              )}
                            </div>
                          </div>
                          {contact.phone && (
                            <CopyButton text={contact.phone} label="phone" />
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {(contact.title || editingContactId === contact.id) && (
                                         <div 
                       className={`p-3 bg-gray-50 rounded-lg ${editingContactId === contact.id ? 'cursor-text hover:bg-gray-100 transition-colors' : 'flex items-center space-x-3'}`}
                       onClick={() => {
                         if (editingContactId === contact.id) {
                           const titleInput = document.querySelector(`input[data-field="title-${contact.id}"]`) as HTMLInputElement;
                           if (titleInput) titleInput.focus();
                         }
                       }}
                    >
                      {editingContactId === contact.id ? (
                        <div className="w-full">
                          <div className="flex items-center space-x-3 mb-2">
                            <User className="h-5 w-5 text-gray-400" />
                            <p className="text-sm font-medium text-gray-900">Title</p>
                          </div>
                          <input
                            type="text"
                            data-field={`title-${contact.id}`}
                            value={editFormData.title || ''}
                            onChange={(e) => handleFormChange('title', e.target.value)}
                            className="w-full text-base text-gray-700 bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400"
                            placeholder="Contact title"
                          />
                        </div>
                      ) : (
                        <>
                          <User className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Title
                            </p>
                            {contact.title ? (
                              <p className="text-base text-gray-700">
                                {contact.title}
                              </p>
                            ) : (
                              <span className="text-base text-gray-500">No title</span>
                            )}
                          </div>
                        </>
                      )}
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
