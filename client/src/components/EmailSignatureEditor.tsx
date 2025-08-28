import { useState, useEffect } from 'react'
import { useUpdateMyEmailSignature } from '../hooks/useSenderIdentities'

export interface EmailSignatureEditorProps {
  initialValue?: string | null
  placeholder?: string
  maxLength?: number
  onSaveSuccess?: () => void
  onSaveError?: (error: string) => void
}

export default function EmailSignatureEditor({
  initialValue,
  placeholder = 'Enter your email signature...',
  maxLength = 5000,
  onSaveSuccess,
  onSaveError,
}: EmailSignatureEditorProps) {
  const [value, setValue] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const updateSignature = useUpdateMyEmailSignature()

  // Initialize value from prop
  useEffect(() => {
    setValue(initialValue || '')
  }, [initialValue])

  const hasUnsavedChanges = value !== (initialValue || '')

  const handleSave = async () => {
    try {
      await updateSignature.mutateAsync(value || null)
      onSaveSuccess?.()
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update signature'
      onSaveError?.(errorMessage)
    }
  }

  const handleChange = (newValue: string) => {
    if (newValue.length <= maxLength) {
      setValue(newValue)
    }
  }

  // Basic HTML sanitization for preview (remove script tags and dangerous attributes)
  const sanitizeHtml = (html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '')
      .replace(/javascript:/gi, '')
  }

  const renderPreview = () => {
    if (!value.trim()) {
      return (
        <div className="text-gray-500 italic p-4">
          No signature content to preview
        </div>
      )
    }

    // Check if content looks like HTML
    const isHtml = /<[a-z][\s\S]*>/i.test(value)

    if (isHtml) {
      return (
        <div
          className="p-4 border border-gray-200 rounded-md bg-white prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
        />
      )
    } else {
      // Plain text - convert line breaks to <br> tags for preview
      return (
        <div className="p-4 border border-gray-200 rounded-md bg-white whitespace-pre-wrap">
          {value}
        </div>
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Email Signature
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <span className="text-xs text-gray-500">
            {value.length}/{maxLength}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {!showPreview ? (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={placeholder}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[var(--color-primary-500)] focus:ring-2 focus:ring-[var(--color-primary-200)] min-h-[120px] font-mono text-sm"
              rows={6}
            />
            <p className="text-xs text-gray-500">
              You can enter plain text or HTML. Common HTML tags like
              &lt;br&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, and &lt;a&gt;
              are supported.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="min-h-[120px]">{renderPreview()}</div>
            <p className="text-xs text-gray-500">
              This is how your signature will appear in emails.
            </p>
          </div>
        )}
      </div>

      {value.length >= maxLength * 0.9 && (
        <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
          You're approaching the character limit. Consider shortening your
          signature.
        </div>
      )}

      {/* Save Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={updateSignature.isPending || !hasUnsavedChanges}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] disabled:opacity-50 shadow-sm"
        >
          {updateSignature.isPending ? 'Saving...' : 'Save Signature'}
        </button>
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-600">Unsaved changes</span>
        )}
      </div>
    </div>
  )
}
