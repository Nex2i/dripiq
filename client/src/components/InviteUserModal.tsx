import React, { useState, useEffect } from 'react'
import { X, Mail, User, Shield } from 'lucide-react'
import { invitesService } from '../services/invites.service'
import type { CreateInviteData } from '../services/invites.service'
import { rolesService } from '../services/roles.service'
import type { Role } from '../services/roles.service'
import { cn } from '../lib/utils'

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
          className="fixed inset-0 bg-background/25 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-card rounded-lg shadow-xl max-w-md w-full mx-auto border">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-primary mr-2" />
              <h3 className="text-lg font-medium text-card-foreground">Invite User</h3>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
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
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                <User className="h-4 w-4 inline mr-1" />
                First name *
              </label>
              <input
                type="text"
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
                  errors.firstName ? "border-destructive" : "border-input"
                )}
                placeholder="Enter first name"
                maxLength={50}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-destructive">{errors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                Last name
              </label>
              <input
                type="text"
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
                  errors.lastName ? "border-destructive" : "border-input"
                )}
                placeholder="Enter last name (optional)"
                maxLength={50}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-destructive">{errors.lastName}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                <Mail className="h-4 w-4 inline mr-1" />
                Email address *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
                  errors.email ? "border-destructive" : "border-input"
                )}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-card-foreground mb-1"
              >
                <Shield className="h-4 w-4 inline mr-1" />
                Role *
              </label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className={cn(
                  "w-full px-3 py-2 border rounded-md shadow-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
                  errors.role ? "border-destructive" : "border-input"
                )}
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
                <p className="mt-1 text-sm text-destructive">{errors.role}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary border border-border rounded-md hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
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
