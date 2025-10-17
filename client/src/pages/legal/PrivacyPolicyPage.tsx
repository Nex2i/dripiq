import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import LegalPageHeader from '../../components/legal/LegalPageHeader'
import LegalPageFooter from '../../components/legal/LegalPageFooter'
import {
  markdownComponents,
  scrollToAnchorWithPadding,
} from '../../utils/markdownComponents'

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate()
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true)
        const response = await fetch('/privacy-policy.md')
        if (!response.ok) {
          throw new Error('Failed to load privacy policy')
        }
        const content = await response.text()
        setMarkdownContent(content)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load privacy policy',
        )
      } finally {
        setLoading(false)
      }
    }

    loadMarkdown()
  }, [])

  // Scroll to anchor on page load
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      // Use setTimeout to ensure DOM is fully rendered
      setTimeout(() => scrollToAnchorWithPadding(hash), 100)
    }
  }, [markdownContent])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading privacy policy...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              Error Loading Privacy Policy
            </h2>
            <p className="text-gray-600">{error}</p>
          </div>
          <button
            onClick={() => navigate({ to: '/' })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <LegalPageHeader maxWidth="6xl" />

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border p-8 lg:p-12">
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {markdownContent}
          </ReactMarkdown>
        </div>
      </div>

      {/* Footer */}
      <LegalPageFooter maxWidth="4xl" />
    </div>
  )
}

export default PrivacyPolicyPage
