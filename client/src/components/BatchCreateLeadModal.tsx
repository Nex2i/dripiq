import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Plus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  Crown,
} from 'lucide-react'
import { useBatchCreateLeads, useUsers } from '../hooks/useLeadsQuery'
import { useAuth } from '../contexts/AuthContext'
import { parseUrlList } from '../utils/urlUtils'
import type { BatchCreateLeadData } from '../services/leads.service'

interface BatchCreateLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function BatchCreateLeadModal({
  isOpen,
  onClose,
  onSuccess,
}: BatchCreateLeadModalProps) {
  const [urlsInput, setUrlsInput] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [inputMode, setInputMode] = useState<'textarea' | 'individual'>(
    'textarea',
  )
  const [individualUrls, setIndividualUrls] = useState<string[]>([''])

  const batchCreateMutation = useBatchCreateLeads()
  const { data: usersResponse, isLoading: usersLoading } = useUsers()
  const { user: authUser } = useAuth()

  const users = usersResponse?.data || []
  const verifiedUsers = useMemo(
    () => users.filter((u: any) => u.hasVerifiedSenderIdentity),
    [users],
  )

  // Parse URLs in real-time based on input mode
  const parsedUrls = useMemo(() => {
    if (inputMode === 'textarea') {
      if (!urlsInput.trim()) return []
      return parseUrlList(urlsInput)
    } else {
      // Individual mode: filter out empty URLs and parse
      const validUrls = individualUrls.filter((url) => url.trim().length > 0)
      if (validUrls.length === 0) return []
      return parseUrlList(validUrls.join('\n'))
    }
  }, [urlsInput, individualUrls, inputMode])

  // Count valid and invalid URLs
  const urlCounts = useMemo(() => {
    const valid = parsedUrls.filter((url) => url.isValid).length
    const invalid = parsedUrls.filter((url) => !url.isValid).length
    const duplicates =
      parsedUrls.length - new Set(parsedUrls.map((url) => url.fullDomain)).size

    return { valid, invalid, duplicates, total: parsedUrls.length }
  }, [parsedUrls])

  // Default ownerId to current user if they are verified
  useEffect(() => {
    const currentUserId = authUser?.user?.id
    if (!selectedOwnerId && currentUserId) {
      const isVerified = verifiedUsers.some((u: any) => u.id === currentUserId)
      if (isVerified) {
        setSelectedOwnerId(currentUserId)
      }
    }
  }, [authUser, verifiedUsers, selectedOwnerId])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setShowResults(false)
    } else {
      setUrlsInput('')
      setIndividualUrls([''])
      setInputMode('textarea')
      setShowResults(false)
    }
  }, [isOpen])

  // Functions for individual URL management
  const addUrlInput = () => {
    setIndividualUrls([...individualUrls, ''])
  }

  const removeUrlInput = (index: number) => {
    if (individualUrls.length > 1) {
      const newUrls = individualUrls.filter((_, i) => i !== index)
      setIndividualUrls(newUrls)
    }
  }

  const updateUrlInput = (index: number, value: string) => {
    const newUrls = [...individualUrls]
    newUrls[index] = value
    setIndividualUrls(newUrls)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedOwnerId) {
      alert('Please select an owner for the leads')
      return
    }

    const validUrls = parsedUrls.filter((url) => url.isValid)
    if (validUrls.length === 0) {
      alert('Please enter at least one valid website URL')
      return
    }

    const batchData: BatchCreateLeadData = {
      websites: validUrls.map((url) => url.cleaned),
      ownerId: selectedOwnerId,
    }

    try {
      await batchCreateMutation.mutateAsync(batchData)
      setShowResults(true)
    } catch (error) {
      console.error('Batch creation failed:', error)
    }
  }

  const handleClose = () => {
    if (showResults && batchCreateMutation.data?.summary.successful) {
      onSuccess()
    }
    onClose()
  }

  const isSubmitting = batchCreateMutation.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Batch Create Leads
              </h2>
              <p className="text-sm text-gray-500">
                Add multiple website URLs to create leads in bulk
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {!showResults ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Owner Selection */}
              <div>
                <label
                  htmlFor="owner"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Assign Owner <span className="text-red-500">*</span>
                </label>
                {usersLoading ? (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading users...</span>
                  </div>
                ) : (
                  <select
                    id="owner"
                    value={selectedOwnerId}
                    onChange={(e) => setSelectedOwnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select an owner...</option>
                    {verifiedUsers.map((user: any) => (
                      <option key={user.id} value={user.id}>
                        <div className="flex items-center">
                          {user.name || user.email}
                          {user.id === authUser?.user?.id && (
                            <Crown className="w-4 h-4 ml-2 text-yellow-500" />
                          )}
                        </div>
                      </option>
                    ))}
                  </select>
                )}
                {verifiedUsers.length === 0 && !usersLoading && (
                  <p className="text-sm text-red-600 mt-1">
                    No verified users available. Users must have verified sender
                    identities to own leads.
                  </p>
                )}
              </div>

              {/* URL Input */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Website URLs <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setInputMode('textarea')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        inputMode === 'textarea'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                      disabled={isSubmitting}
                    >
                      Bulk Input
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('individual')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        inputMode === 'individual'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                      }`}
                      disabled={isSubmitting}
                    >
                      Individual Input
                    </button>
                  </div>
                </div>

                {inputMode === 'textarea' ? (
                  <>
                    <textarea
                      id="websites"
                      value={urlsInput}
                      onChange={(e) => setUrlsInput(e.target.value)}
                      placeholder="Enter website URLs, one per line or comma-separated:&#10;https://example.com, https://company.com&#10;another-site.org"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px] font-mono text-sm"
                      disabled={isSubmitting}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Enter website URLs one per line or comma-separated.
                      Duplicates will be automatically removed.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {individualUrls.map((url, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="text"
                            value={url}
                            onChange={(e) =>
                              updateUrlInput(index, e.target.value)
                            }
                            placeholder="https://example.com"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none text-sm"
                            disabled={isSubmitting}
                          />
                          {individualUrls.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeUrlInput(index)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                              disabled={isSubmitting}
                              title="Remove URL"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addUrlInput}
                      className="mt-2 inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                      disabled={isSubmitting}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Another URL
                    </button>
                    <p className="text-sm text-gray-500 mt-1">
                      Add website URLs individually. Click "Add Another URL" to
                      add more inputs.
                    </p>
                  </>
                )}
              </div>

              {/* URL Preview */}
              {parsedUrls.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Preview ({urlCounts.total} URLs)
                  </h3>

                  {/* Summary */}
                  <div className="flex items-center space-x-4 mb-4 text-sm">
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{urlCounts.valid} valid</span>
                    </div>
                    {urlCounts.invalid > 0 && (
                      <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>{urlCounts.invalid} invalid</span>
                      </div>
                    )}
                    {urlCounts.duplicates > 0 && (
                      <div className="flex items-center space-x-1 text-yellow-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>{urlCounts.duplicates} duplicates</span>
                      </div>
                    )}
                  </div>

                  {/* URL List */}
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {parsedUrls.map((url, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-2 rounded border ${
                          url.isValid
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <Globe
                            className={`w-4 h-4 flex-shrink-0 ${
                              url.isValid ? 'text-green-600' : 'text-red-600'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {url.isValid ? url.domain : url.original}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {url.isValid ? url.fullDomain : url.error}
                            </div>
                          </div>
                        </div>
                        {url.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting || urlCounts.valid === 0 || !selectedOwnerId
                  }
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Leads...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create {urlCounts.valid} Leads</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Results View */
            <div className="space-y-6">
              {batchCreateMutation.data && (
                <>
                  {/* Summary */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-blue-900 mb-2">
                      Batch Creation Complete
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {batchCreateMutation.data.summary.total}
                        </div>
                        <div className="text-blue-800">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {batchCreateMutation.data.summary.successful}
                        </div>
                        <div className="text-green-800">Successful</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {batchCreateMutation.data.summary.failed}
                        </div>
                        <div className="text-red-800">Failed</div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Results */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Detailed Results
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {batchCreateMutation.data.results.map((result, index) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded border ${
                            result.success
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            {result.success ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {result.success ? result.name : result.url}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {result.success ? result.url : result.error}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Close Button */}
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      onClick={handleClose}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}

              {batchCreateMutation.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-medium text-red-900">
                      Batch Creation Failed
                    </h3>
                  </div>
                  <p className="text-red-700 mt-2">
                    {batchCreateMutation.error instanceof Error
                      ? batchCreateMutation.error.message
                      : 'An unexpected error occurred'}
                  </p>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => setShowResults(false)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
