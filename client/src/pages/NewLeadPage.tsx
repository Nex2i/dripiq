import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCreateLead } from '../hooks/useLeadsQuery'
import type { CreateLeadData } from '../services/leads.service'
import { Plus, X, User, Crown, Check, Loader2 } from 'lucide-react'
import { HOME_URL } from '../constants/navigation'

interface ContactFormData {
  name: string
  email: string
  phone?: string
  title?: string
  company?: string
}

const NewLeadPage: React.FC = () => {
  const navigate = useNavigate()
  const createLeadMutation = useCreateLead()
  const [formData, setFormData] = useState<
    Omit<CreateLeadData, 'pointOfContacts'>
  >({
    name: '',
    url: '',
  })
  const [contacts, setContacts] = useState<ContactFormData[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleContactChange = (
    index: number,
    field: keyof ContactFormData,
    value: string,
  ) => {
    setContacts((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addContact = () => {
    setContacts((prev) => [...prev, { name: '', email: '' }])
  }

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Filter out empty contacts and ensure required fields are filled
    const validContacts = contacts.filter(
      (contact) => contact.name.trim() && contact.email.trim(),
    )

    const submitData: CreateLeadData = {
      ...formData,
      pointOfContacts: validContacts.length > 0 ? validContacts : undefined,
    }

    createLeadMutation.mutate(submitData, {
      onSuccess: (newLead) => {
        console.log(newLead)
        // Redirect to the new lead detail page
        navigate({ to: `/leads/${newLead.id}` })
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : 'Failed to create lead')
      },
    })
  }

  const handleCancel = () => {
    navigate({ to: HOME_URL })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Lead</h1>
          <p className="mt-2 text-gray-600">
            Enter the details for your new lead and any associated contacts.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Lead Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Lead Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Lead Name *
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
              </div>
            </div>

            {/* Point of Contacts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Point of Contacts
                </h2>
                <button
                  type="button"
                  onClick={addContact}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)] transition-colors"
                  disabled={createLeadMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <User className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No contacts added yet. Click "Add Contact" to add one.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {contacts.map((contact, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <h3 className="text-sm font-medium text-gray-900">
                            Contact {index + 1}
                          </h3>
                          {index === 0 && (
                            <div className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <Crown className="h-3 w-3 mr-1" />
                              Primary
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContact(index)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          disabled={createLeadMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) =>
                              handleContactChange(index, 'name', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                            required
                            disabled={createLeadMutation.isPending}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email *
                          </label>
                          <input
                            type="email"
                            value={contact.email}
                            onChange={(e) =>
                              handleContactChange(
                                index,
                                'email',
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                            required
                            disabled={createLeadMutation.isPending}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={contact.phone || ''}
                            onChange={(e) =>
                              handleContactChange(
                                index,
                                'phone',
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                            disabled={createLeadMutation.isPending}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={contact.title || ''}
                            onChange={(e) =>
                              handleContactChange(
                                index,
                                'title',
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                            disabled={createLeadMutation.isPending}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company
                          </label>
                          <input
                            type="text"
                            value={contact.company || ''}
                            onChange={(e) =>
                              handleContactChange(
                                index,
                                'company',
                                e.target.value,
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-colors"
                            disabled={createLeadMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
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
