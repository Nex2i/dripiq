import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import Logo from '../components/Logo'

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
        setError(err instanceof Error ? err.message : 'Failed to load privacy policy')
      } finally {
        setLoading(false)
      }
    }

    loadMarkdown()
  }, [])

  // Simple markdown to HTML converter for basic markdown
  const markdownToHtml = (markdown: string): string => {
    return markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-gray-900 mt-8 mb-4">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-semibold text-gray-900 mt-10 mb-6">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-8">$1</h1>')
      // Bold
      .replace(/\*\*(.*)\*\*/gim, '<strong class="font-semibold">$1</strong>')
      // Italic
      .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')
      // Links
      .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Lists
      .replace(/^\* (.*$)/gim, '<li class="mb-2">$1</li>')
      .replace(/(<li.*<\/li>)/gims, '<ul class="list-disc list-inside mb-4 space-y-1">$1</ul>')
      // Paragraphs
      .replace(/^(?!<[h|u|l])(.+)$/gim, '<p class="mb-4 text-gray-700 leading-relaxed">$1</p>')
      // Line breaks
      .replace(/\n/gim, '<br/>')
  }

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
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Error Loading Privacy Policy</h2>
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
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="sm" showText={true} />
            </div>
            <button
              onClick={() => navigate({ to: '/' })}
              className="text-sm text-gray-500 hover:text-gray-700 underline bg-transparent border-none cursor-pointer inline-flex items-center"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border p-8 lg:p-12">
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: markdownToHtml(markdownContent) 
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Logo size="sm" showText={true} />
          </div>
          <p className="text-center text-gray-400">
            © 2025 dripIq. Built with ❤️ for sales teams.
          </p>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage