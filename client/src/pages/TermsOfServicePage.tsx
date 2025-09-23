import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Logo from '../components/Logo'

const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate()
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true)
        const response = await fetch('/terms-of-service.md')
        if (!response.ok) {
          throw new Error('Failed to load terms of service')
        }
        const content = await response.text()
        setMarkdownContent(content)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load terms of service',
        )
      } finally {
        setLoading(false)
      }
    }

    loadMarkdown()
  }, [])

  // Custom components for react-markdown with Tailwind styling
  const markdownComponents = {
    h1: ({ children }: any) => (
      <h1 className="text-3xl font-bold text-gray-900 mt-12 mb-8 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-6">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
        {children}
      </h3>
    ),
    p: ({ children }: any) => (
      <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside mb-4 space-y-1 ml-4">{children}</ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside mb-4 space-y-1 ml-4">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="mb-2 text-gray-700">{children}</li>
    ),
    strong: ({ children }: any) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }: any) => <em className="italic">{children}</em>,
    a: ({ href, children }: any) => (
      <a
        href={href}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 mb-4 italic text-gray-600">
        {children}
      </blockquote>
    ),
    code: ({ children }: any) => (
      <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
    pre: ({ children }: any) => (
      <pre className="bg-gray-100 p-4 rounded-lg mb-4 overflow-x-auto">
        {children}
      </pre>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto mb-6 shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300 rounded-lg bg-white">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-gray-50">{children}</thead>
    ),
    tbody: ({ children }: any) => (
      <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
    ),
    tr: ({ children }: any) => <tr className="hover:bg-gray-50">{children}</tr>,
    th: ({ children }: any) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="px-6 py-4 text-sm text-gray-900 border-b border-gray-200 align-top">
        <div className="max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg">
          {children}
        </div>
      </td>
    ),
    hr: () => <hr className="my-8 border-t border-gray-300" />,
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading terms of service...</p>
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
              Error Loading Terms of Service
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
          <ReactMarkdown
            components={markdownComponents}
            remarkPlugins={[remarkGfm]}
          >
            {markdownContent}
          </ReactMarkdown>
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

export default TermsOfServicePage