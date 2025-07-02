import React, { useState } from 'react'
import type { CreateLeadData } from '../services/leads.service'
import { useNavigate } from '@tanstack/react-router'
import { useCreateLead } from '../hooks/useLeadsQuery'
import { X } from 'lucide-react'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
}

const AddLeadModal: React.FC<AddLeadModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const createLeadMutation = useCreateLead()
  const [formData, setFormData] = useState<CreateLeadData>({
    name: '',
    email: '',
    company: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      company: '',
      phone: '',
    })
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev: CreateLeadData) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    createLeadMutation.mutate(formData, {
      onSuccess: () => {
        resetForm()
        onClose()
        // Redirect to leads page (cache will be automatically updated)
        navigate({ to: '/leads' })
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to add lead')
      },
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-neutral-900/25 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-surface-primary rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <h2 className="text-2xl font-bold text-text-primary">Add New Lead</h2>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="company"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Company Name *
            </label>
            <input
              type="text"
              id="company"
              name="company"
              required
              value={formData.company}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border-primary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-surface-primary text-text-primary"
              placeholder="Enter company name"
            />
          </div>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Contact Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border-primary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-surface-primary text-text-primary"
              placeholder="Enter contact name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border-primary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-surface-primary text-text-primary"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-border-primary rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-surface-primary text-text-primary"
              placeholder="Enter phone number"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-text-secondary bg-neutral-100 hover:bg-neutral-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLeadMutation.isPending}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-text-inverse rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {createLeadMutation.isPending && (
                <div
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-text-inverse"
                  style={{
                    borderTop: '2px solid currentColor',
                    borderRight: '2px solid transparent',
                    borderRadius: '50%',
                  }}
                />
              )}
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddLeadModal
