import React, { useState } from 'react'
import type { CreateLeadData } from '../services/leads.service'
import { useNavigate } from '@tanstack/react-router'
import { useCreateLead } from '../hooks/useLeadsQuery'
import { cn } from '../lib/utils'

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
    <div className="fixed inset-0 bg-background/25 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-card rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-card-foreground">Add New Lead</h2>
            <button
              onClick={handleClose}
              className={cn(
                "text-muted-foreground hover:text-foreground transition-colors",
                createLeadMutation.isPending && "opacity-50 cursor-not-allowed"
              )}
              disabled={createLeadMutation.isPending}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background text-foreground"
                required
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background text-foreground"
                required
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="company"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Company
              </label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background text-foreground"
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring transition-colors bg-background text-foreground"
                disabled={createLeadMutation.isPending}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className={cn(
                  "px-4 py-2 text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors",
                  createLeadMutation.isPending && "opacity-50 cursor-not-allowed"
                )}
                disabled={createLeadMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(
                  "px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors flex items-center",
                  createLeadMutation.isPending && "opacity-50 cursor-not-allowed"
                )}
                disabled={createLeadMutation.isPending}
              >
                {createLeadMutation.isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
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
                    Adding...
                  </>
                ) : (
                  'Add Lead'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AddLeadModal
