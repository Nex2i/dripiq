import React, { useState, useEffect } from 'react'
import { X, Mail, User, Shield } from 'lucide-react'
import { invitesService } from '../services/invites.service'
import type { CreateInviteData } from '../services/invites.service'
import { rolesService } from '../services/roles.service'
import type { Role } from '../services/roles.service'

interface InviteUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface InviteFormData {
  firstName: string
  lastName: string
  email: string
  role: string
}

export function InviteUserModal({
  isOpen,
  onClose,
  onSuccess,
}: InviteUserModalProps) {
  const [formData, setFormData] = useState<InviteFormData>({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
  })

  const [errors, setErrors] = useState<
    Partial<Record<keyof InviteFormData, string>>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(false)

  // Fetch roles when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchRoles()
    }
  }, [isOpen])

  const fetchRoles = async () => {
    setIsLoadingRoles(true)
    try {
      const fetchedRoles = await rolesService.getRoles()
      setRoles(fetchedRoles)

      // Set default role to the first available role
      if (fetchedRoles.length > 0 && !formData.role) {
        setFormData((prev) => ({ ...prev, role: fetchedRoles[0].name }))
      }
    } catch (error) {
      console.error('Error fetching roles:', error)
      // You could show an error message to the user here
    } finally {
      setIsLoadingRoles(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof InviteFormData, string>> = {}

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    } else if (formData.firstName.length > 50) {
      newErrors.firstName = 'First name must be 50 characters or less'
    }

    // Last name validation (optional but has length limit)
    if (formData.lastName.length > 50) {
      newErrors.lastName = 'Last name must be 50 characters or less'
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address'
      }
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = 'Role is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const inviteData: CreateInviteData = {
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        email: formData.email,
        role: formData.role, // Send actual role name from database
      }

      await invitesService.createInvite(inviteData)

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        role: roles.length > 0 ? roles[0].name : '',
      })
      setErrors({})

      onSuccess()
    } catch (error) {
      console.error('Error sending invite:', error)
      // Show error to user
      setErrors({
        email:
          error instanceof Error ? error.message : 'Failed to send invitation',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (
    field: keyof InviteFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-opacity-25 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <Mail className="h-5 w-5 mr-2" style={{ color: '#4361EE' }} />
              <h3 className="text-lg font-medium text-gray-900">Invite User</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* First Name */}
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <User className="h-4 w-4 inline mr-1" />
                First name *
              </label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className={`input-field ${
                  errors.firstName ? 'border-red-300' : ''
                }`}
                placeholder="Enter first name"
                maxLength={50}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Last name
              </label>
              <input
                type="text"
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className={`input-field ${
                  errors.lastName ? 'border-red-300' : ''
                }`}
                placeholder="Enter last name (optional)"
                maxLength={50}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <Mail className="h-4 w-4 inline mr-1" />
                Email address *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`input-field ${
                  errors.email ? 'border-red-300' : ''
                }`}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                <Shield className="h-4 w-4 inline mr-1" />
                Role *
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className={`input-field ${
                  errors.role ? 'border-red-300' : ''
                }`}
                disabled={isLoadingRoles}
              >
                {isLoadingRoles ? (
                  <option value="">Loading roles...</option>
                ) : (
                  <>
                    {roles.length === 0 ? (
                      <option value="">No roles available</option>
                    ) : (
                      roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))
                    )}
                  </>
                )}
              </select>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
