import React, { useEffect, useState } from 'react'
import {
  Users,
  User,
  Crown,
  Mail,
  Phone,
  Building,
  ExternalLink,
  Target,
  Loader2,
  Edit3,
  Save,
  X,
  Plus,
  UserX,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import CopyButton from '../CopyButton'
import ContactStrategyModal from '../ContactStrategyModal'
import CreateContactModal from '../CreateContactModal'
import AnimatedCheckbox from '../AnimatedCheckbox'
import type { LeadPointOfContact } from '../../types/lead.types'
import { getLeadsService } from '../../services/leads.service'
import {
  useUpdateContact,
  useToggleContactManuallyReviewed,
  useCreateContact,
  useUnsubscribeContact,
} from '../../hooks/useLeadsQuery'

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
  const [contactStrategyModalOpen, setContactStrategyModalOpen] =
    useState(false)
  const [contactStrategyData, setContactStrategyData] = useState<any>(null)
  const [selectedContactName, setSelectedContactName] = useState<string>('')
  const [createContactModalOpen, setCreateContactModalOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<Partial<LeadPointOfContact>>(
    {},
  )
  const [originalFormData, setOriginalFormData] = useState<
    Partial<LeadPointOfContact>
  >({})
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string
  }>({})
  const [unsubscribeModalOpen, setUnsubscribeModalOpen] = useState(false)
  const [contactToUnsubscribe, setContactToUnsubscribe] =
    useState<LeadPointOfContact | null>(null)
  const leadsService = getLeadsService()

  useEffect(() => {
    if (!contactStrategyModalOpen) {
      setQualifyingContactId(null)
      setSelectedContactName('')
      setContactStrategyData(null)
    }
  }, [contactStrategyModalOpen])

  const updateContactMutation = useUpdateContact(
    // onSuccess callback
    () => {
      handleCancelEdit()
    },
    // onError callback
    (error) => {
      console.error('Failed to update contact:', error)
      // You might want to show a toast notification here
    },
  )

  const toggleManuallyReviewedMutation = useToggleContactManuallyReviewed()

  const createContactMutation = useCreateContact(
    // onSuccess callback
    (contact) => {
      setCreateContactModalOpen(false)
      console.log('Contact created successfully:', contact)
    },
    // onError callback
    (error) => {
      console.error('Failed to create contact:', error)
      // You might want to show a toast notification here
    },
  )

  const unsubscribeContactMutation = useUnsubscribeContact(
    // onSuccess callback
    () => {
      setUnsubscribeModalOpen(false)
      setContactToUnsubscribe(null)
      console.log('Contact unsubscribed successfully')
    },
    // onError callback
    (error) => {
      console.error('Failed to unsubscribe contact:', error)
      // You might want to show a toast notification here
    },
  )

  const generateContactStrategyMutation = useMutation({
    mutationFn: (contactId: string) =>
      leadsService.generateContactStrategy(leadId, contactId),
    onMutate: (contactId) => {
      const contact = contacts.find((c) => c.id === contactId)
      if (contact) {
        setQualifyingContactId(contact.id)
        setSelectedContactName(contact.name)
      }
    },
    onSuccess: (result) => {
      // API now returns the plan directly (no { data })
      setContactStrategyData(result)
      setContactStrategyModalOpen(true)
    },
    onError: (error) => {
      console.error('Failed to generate contact strategy:', error)
      // You might want to show a toast notification here
    },
  })

  const handleToggleManuallyReviewed = (contact: LeadPointOfContact) => {
    setLoadingContactId(contact.id)
    toggleManuallyReviewedMutation.mutate(
      {
        leadId,
        contactId: contact.id,
        manuallyReviewed: !contact.manuallyReviewed,
      },
      {
        onSettled: () => {
          setLoadingContactId(null)
        },
      },
    )
  }

  const handleGenerateContactStrategy = (contactId: string) => {
    generateContactStrategyMutation.mutate(contactId)
  }

  const handleCreateContact = (contactData: {
    name: string
    email: string
    phone?: string
    title?: string
  }) => {
    createContactMutation.mutate({
      leadId,
      contactData,
    })
  }

  const handleUnsubscribeContact = (contact: LeadPointOfContact) => {
    setContactToUnsubscribe(contact)
    setUnsubscribeModalOpen(true)
  }

  const handleConfirmUnsubscribe = () => {
    if (contactToUnsubscribe) {
      unsubscribeContactMutation.mutate({
        leadId,
        contactId: contactToUnsubscribe.id,
      })
    }
  }

  const handleCancelUnsubscribe = () => {
    setUnsubscribeModalOpen(false)
    setContactToUnsubscribe(null)
  }

  const handleEditContact = (contact: LeadPointOfContact) => {
    const editableData = {
      name: contact.name,
      email: contact.email,
      phone: contact.phone ? formatPhoneNumber(contact.phone) : '',
      title: contact.title || '',
    }
    setEditingContactId(contact.id)
    setEditFormData(editableData)
    setOriginalFormData(editableData)
    setValidationErrors({})

    // Auto-focus the name input after the component re-renders
    setTimeout(() => {
      const nameInput = document.querySelector(
        `input[data-field="name-${contact.id}"]`,
      ) as HTMLInputElement
      if (nameInput) nameInput.focus()
    }, 0)
  }

  const handleCancelEdit = () => {
    setEditingContactId(null)
    setEditFormData({})
    setOriginalFormData({})
    setValidationErrors({})
  }

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return 'Email is required'

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'

    // Check for common issues
    if (email.includes('..')) return 'Email cannot contain consecutive dots'
    if (email.startsWith('.') || email.endsWith('.'))
      return 'Email cannot start or end with a dot'
    if (email.includes(' ')) return 'Email cannot contain spaces'

    // Check domain part
    const domain = email.split('@')[1]
    if (domain && domain.length < 2) return 'Email domain is too short'

    return null
  }

  const validatePhoneNumber = (phone: string): string | null => {
    if (!phone.trim()) return null // Phone is optional

    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '')

    // US phone number should have exactly 10 digits (without country code) or 11 digits (with country code 1)
    if (digitsOnly.length === 10) {
      // Valid 10-digit US number - check that area code and exchange code are valid
      const areaCode = digitsOnly.slice(0, 3)
      const exchangeCode = digitsOnly.slice(3, 6)

      // Area code cannot start with 0 or 1
      if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
        return 'Invalid area code - cannot start with 0 or 1'
      }

      // Exchange code cannot start with 0 or 1
      if (exchangeCode.startsWith('0') || exchangeCode.startsWith('1')) {
        return 'Invalid phone number format'
      }

      return null
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      // Valid 11-digit US number with country code - validate the same way
      const areaCode = digitsOnly.slice(1, 4)
      const exchangeCode = digitsOnly.slice(4, 7)

      if (areaCode.startsWith('0') || areaCode.startsWith('1')) {
        return 'Invalid area code - cannot start with 0 or 1'
      }

      if (exchangeCode.startsWith('0') || exchangeCode.startsWith('1')) {
        return 'Invalid phone number format'
      }

      return null
    } else if (digitsOnly.length < 10) {
      return 'Phone number is too short - must be 10 digits'
    } else {
      return 'Phone number is too long - must be 10 digits'
    }
  }

  const validateField = (field: string, value: string): string | null => {
    switch (field) {
      case 'name':
        return !value.trim() ? 'Name is required' : null
      case 'email':
        return validateEmail(value)
      case 'phone':
        return validatePhoneNumber(value)
      default:
        return null
    }
  }

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, '')

    // Don't format if empty
    if (!digitsOnly) return ''

    // Format based on length
    if (digitsOnly.length <= 3) {
      return digitsOnly
    } else if (digitsOnly.length <= 6) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`
    } else if (digitsOnly.length <= 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`
    } else {
      // Limit to 10 digits for US numbers
      const truncated = digitsOnly.slice(0, 10)
      return `(${truncated.slice(0, 3)}) ${truncated.slice(3, 6)}-${truncated.slice(6)}`
    }
  }

  const handleFormChange = (field: keyof LeadPointOfContact, value: string) => {
    let processedValue = value

    // Format phone number as user types
    if (field === 'phone') {
      processedValue = formatPhoneNumber(value)
    }

    setEditFormData((prev) => ({
      ...prev,
      [field]: processedValue,
    }))

    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleBlur = (field: string, value: string) => {
    const error = validateField(field, value)
    if (error) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: error,
      }))
    }
  }

  const handleSaveContact = () => {
    if (!editingContactId) return

    // Validate all fields
    const errors: { [key: string]: string } = {}

    const nameError = validateField('name', editFormData.name || '')
    if (nameError) errors.name = nameError

    const emailError = validateField('email', editFormData.email || '')
    if (emailError) errors.email = emailError

    const phoneError = validateField('phone', editFormData.phone || '')
    if (phoneError) errors.phone = phoneError

    // If there are validation errors, show them and don't proceed
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              Point of Contacts
            </h2>
          </div>
          <button
            onClick={() => setCreateContactModalOpen(true)}
            disabled={
              editingContactId !== null || createContactMutation.isPending
            }
            className="inline-flex items-center px-3 py-2 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-200 hover:shadow-md transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-sm"
            title="Create a new contact for this lead"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Contact
          </button>
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
                          const nameInput = document.querySelector(
                            `input[data-field="name-${contact.id}"]`,
                          ) as HTMLInputElement
                          if (nameInput) nameInput.focus()
                        }}
                      >
                        <div className="flex-1">
                          <input
                            type="text"
                            data-field={`name-${contact.id}`}
                            value={editFormData.name || ''}
                            onChange={(e) =>
                              handleFormChange('name', e.target.value)
                            }
                            onBlur={(e) => handleBlur('name', e.target.value)}
                            className={`text-lg font-medium bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400 min-w-0 w-full ${
                              validationErrors.name
                                ? 'text-red-600'
                                : 'text-gray-900'
                            }`}
                            placeholder="Contact name"
                            required
                          />
                          {validationErrors.name && (
                            <p className="text-red-500 text-sm mt-1">
                              {validationErrors.name}
                            </p>
                          )}
                        </div>
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
                          disabled={
                            updateContactMutation.isPending ||
                            Object.keys(validationErrors).length > 0
                          }
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            Object.keys(validationErrors).length > 0
                              ? 'Please fix validation errors before saving'
                              : 'Save changes'
                          }
                        >
                          {updateContactMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">
                            {updateContactMutation.isPending
                              ? 'Saving...'
                              : 'Save'}
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
                          disabled={
                            editingContactId !== null ||
                            qualifyingContactId === contact.id ||
                            loadingContactId === contact.id
                          }
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit contact"
                        >
                          <Edit3 className="h-4 w-4" />
                          <span className="text-sm font-medium">Edit</span>
                        </button>
                        <button
                          onClick={() =>
                            handleGenerateContactStrategy(contact.id)
                          }
                          disabled={
                            qualifyingContactId === contact.id ||
                            editingContactId !== null
                          }
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Generate contact strategy for this contact"
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
                          onClick={() => handleUnsubscribeContact(contact)}
                          disabled={
                            editingContactId !== null ||
                            qualifyingContactId === contact.id ||
                            unsubscribeContactMutation.isPending ||
                            !contact.email
                          }
                          className="flex items-center space-x-2 px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            !contact.email
                              ? 'Contact must have an email to unsubscribe'
                              : 'Unsubscribe this contact from email communications'
                          }
                        >
                          <UserX className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Unsubscribe
                          </span>
                        </button>
                        <AnimatedCheckbox
                          checked={contact.manuallyReviewed}
                          onChange={() => handleToggleManuallyReviewed(contact)}
                          disabled={
                            loadingContactId === contact.id ||
                            editingContactId !== null ||
                            toggleManuallyReviewedMutation.isPending
                          }
                          loading={
                            loadingContactId === contact.id ||
                            toggleManuallyReviewedMutation.isPending
                          }
                          label="Manually Reviewed"
                          title={
                            contact.manuallyReviewed
                              ? 'Mark as not manually reviewed'
                              : 'Mark as manually reviewed'
                          }
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    className={`p-3 bg-gray-50 rounded-lg ${editingContactId === contact.id ? 'cursor-text hover:bg-gray-100 transition-colors' : 'flex items-center justify-between'}`}
                    onClick={() => {
                      if (editingContactId === contact.id) {
                        const emailInput = document.querySelector(
                          `input[data-field="email-${contact.id}"]`,
                        ) as HTMLInputElement
                        if (emailInput) emailInput.focus()
                      }
                    }}
                  >
                    {editingContactId === contact.id ? (
                      <div className="w-full">
                        <div className="flex items-center space-x-3 mb-2">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <p className="text-sm font-medium text-gray-900">
                            Email
                          </p>
                        </div>
                        <input
                          type="email"
                          data-field={`email-${contact.id}`}
                          value={editFormData.email || ''}
                          onChange={(e) =>
                            handleFormChange('email', e.target.value)
                          }
                          onBlur={(e) => handleBlur('email', e.target.value)}
                          className={`w-full text-base bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400 ${
                            validationErrors.email
                              ? 'text-red-600'
                              : 'text-[var(--color-primary-600)]'
                          }`}
                          placeholder="Contact email"
                          required
                        />
                        {validationErrors.email && (
                          <p className="text-red-500 text-sm mt-1">
                            {validationErrors.email}
                          </p>
                        )}
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
                          const phoneInput = document.querySelector(
                            `input[data-field="phone-${contact.id}"]`,
                          ) as HTMLInputElement
                          if (phoneInput) phoneInput.focus()
                        }
                      }}
                    >
                      {editingContactId === contact.id ? (
                        <div className="w-full">
                          <div className="flex items-center space-x-3 mb-2">
                            <Phone className="h-5 w-5 text-gray-400" />
                            <p className="text-sm font-medium text-gray-900">
                              Phone
                            </p>
                          </div>
                          <input
                            type="tel"
                            data-field={`phone-${contact.id}`}
                            value={editFormData.phone || ''}
                            onChange={(e) =>
                              handleFormChange('phone', e.target.value)
                            }
                            onBlur={(e) => handleBlur('phone', e.target.value)}
                            className={`w-full text-base bg-transparent border-none outline-none focus:ring-0 p-0 placeholder-gray-400 ${
                              validationErrors.phone
                                ? 'text-red-600'
                                : 'text-[var(--color-primary-600)]'
                            }`}
                            placeholder="Contact phone (US format)"
                          />
                          {validationErrors.phone && (
                            <p className="text-red-500 text-sm mt-1">
                              {validationErrors.phone}
                            </p>
                          )}
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
                                <span className="text-base text-gray-500">
                                  No phone
                                </span>
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
                          const titleInput = document.querySelector(
                            `input[data-field="title-${contact.id}"]`,
                          ) as HTMLInputElement
                          if (titleInput) titleInput.focus()
                        }
                      }}
                    >
                      {editingContactId === contact.id ? (
                        <div className="w-full">
                          <div className="flex items-center space-x-3 mb-2">
                            <User className="h-5 w-5 text-gray-400" />
                            <p className="text-sm font-medium text-gray-900">
                              Title
                            </p>
                          </div>
                          <input
                            type="text"
                            data-field={`title-${contact.id}`}
                            value={editFormData.title || ''}
                            onChange={(e) =>
                              handleFormChange('title', e.target.value)
                            }
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
                              <span className="text-base text-gray-500">
                                No title
                              </span>
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

      <ContactStrategyModal
        isOpen={contactStrategyModalOpen}
        onClose={() => setContactStrategyModalOpen(false)}
        data={contactStrategyData}
        contactName={selectedContactName}
        companyName={companyName || 'Unknown Company'}
        leadId={leadId}
        contactId={qualifyingContactId || undefined}
        onDataUpdate={(updatedData) => setContactStrategyData(updatedData)}
      />

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={createContactModalOpen}
        onClose={() => setCreateContactModalOpen(false)}
        onSubmit={handleCreateContact}
        isSubmitting={createContactMutation.isPending}
      />

      {/* Unsubscribe Confirmation Modal */}
      {unsubscribeModalOpen && contactToUnsubscribe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <UserX className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">
                Unsubscribe Contact
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to unsubscribe{' '}
              <span className="font-medium text-gray-900">
                {contactToUnsubscribe.name}
              </span>{' '}
              ({contactToUnsubscribe.email}) from email communications?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This action will prevent them from receiving future campaign
              emails.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelUnsubscribe}
                disabled={unsubscribeContactMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnsubscribe}
                disabled={unsubscribeContactMutation.isPending}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {unsubscribeContactMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Unsubscribing...</span>
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4" />
                    <span>Unsubscribe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactsTab
