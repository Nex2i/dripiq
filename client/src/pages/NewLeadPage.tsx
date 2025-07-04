import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateLead } from '../hooks/useLeadsQuery'
import type { CreateLeadData } from '../services/leads.service'

const NewLeadPage: React.FC = () => {
  const navigate = useNavigate()
  const createLeadMutation = useCreateLead()
  const [formData, setFormData] = useState<CreateLeadData>({
    name: '',
    email: '',
    url: '',
    company: '',
    phone: '',
  })
  const [error, setError] = useState<string | null>(null)

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
      onSuccess: (newLead) => {
        // Redirect to the new lead detail page
        navigate({ to: `/leads/${newLead.lead.id}` })
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to create lead')
      },
    })
  }

  const handleCancel = () => {
    navigate({ to: '/leads' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Lead</h1>
          <p className="mt-2 text-gray-600">
            Enter the details for your new lead below.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                required
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                required
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Website URL *
              </label>
              <input
                type="url"
                id="url"
                name="url"
                value={formData.url}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                required
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Company
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                disabled={createLeadMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                disabled={createLeadMutation.isPending}
              >
                {createLeadMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Lead'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default NewLeadPage
