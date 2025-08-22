import React, { useState } from 'react'
import { X, User, Mail, Phone, UserCheck, Loader2 } from 'lucide-react'

interface CreateContactModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (contactData: {
    name: string
    email: string
    phone?: string
    title?: string
  }) => void
  isSubmitting?: boolean
}

interface FormData {
  name: string
  email: string
  phone: string
  title: string
}

interface ValidationErrors {
  [key: string]: string
}

const CreateContactModal: React.FC<CreateContactModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    title: '',
  })

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

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

  const handleInputChange = (field: keyof FormData, value: string) => {
    let processedValue = value

    // Format phone number as user types
    if (field === 'phone') {
      processedValue = formatPhoneNumber(value)
    }

    setFormData((prev) => ({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate all fields
    const errors: ValidationErrors = {}

    const nameError = validateField('name', formData.name)
    if (nameError) errors.name = nameError

    const emailError = validateField('email', formData.email)
    if (emailError) errors.email = emailError

    const phoneError = validateField('phone', formData.phone)
    if (phoneError) errors.phone = phoneError

    // If there are validation errors, show them and don't proceed
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    // Prepare data for submission
    const submitData: {
      name: string
      email: string
      phone?: string
      title?: string
    } = {
      name: formData.name.trim(),
      email: formData.email.trim(),
    }

    if (formData.phone.trim()) {
      submitData.phone = formData.phone.trim()
    }

    if (formData.title.trim()) {
      submitData.title = formData.title.trim()
    }

    onSubmit(submitData)
  }

  const handleClose = () => {
    if (isSubmitting) return // Prevent closing while submitting

    // Reset form data
    setFormData({
      name: '',
      email: '',
      phone: '',
      title: '',
    })
    setValidationErrors({})
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <User className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-lg font-medium text-gray-900">
                Create New Contact
              </span>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Name Field */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <div className="flex items-center">
                  <User className="h-4 w-4 text-gray-400 mr-2" />
                  Name *
                </div>
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onBlur={(e) => handleBlur('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors ${
                  validationErrors.name
                    ? 'border-red-300 text-red-600'
                    : 'border-gray-300 text-gray-900'
                }`}
                placeholder="Contact name"
                required
                disabled={isSubmitting}
              />
              {validationErrors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.name}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-400 mr-2" />
                  Email *
                </div>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                onBlur={(e) => handleBlur('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors ${
                  validationErrors.email
                    ? 'border-red-300 text-red-600'
                    : 'border-gray-300 text-gray-900'
                }`}
                placeholder="contact@company.com"
                required
                disabled={isSubmitting}
              />
              {validationErrors.email && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Phone Field */}
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-2" />
                  Phone
                </div>
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                onBlur={(e) => handleBlur('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors ${
                  validationErrors.phone
                    ? 'border-red-300 text-red-600'
                    : 'border-gray-300 text-gray-900'
                }`}
                placeholder="(555) 123-4567"
                disabled={isSubmitting}
              />
              {validationErrors.phone && (
                <p className="text-red-500 text-sm mt-1">
                  {validationErrors.phone}
                </p>
              )}
            </div>

            {/* Title Field */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <div className="flex items-center">
                  <UserCheck className="h-4 w-4 text-gray-400 mr-2" />
                  Title
                </div>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors text-gray-900"
                placeholder="Job title"
                disabled={isSubmitting}
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting || Object.keys(validationErrors).length > 0
                }
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary-600)] border border-transparent rounded-md hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Contact'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateContactModal
