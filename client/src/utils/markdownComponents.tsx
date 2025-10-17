// Shared markdown components for consistent formatting across pages
import { useState } from 'react'
import { Link, Check } from 'lucide-react'

// Helper function to copy text to clipboard
const copyToClipboard = async (
  text: string,
  setCopied?: (copied: boolean) => void,
) => {
  try {
    await navigator.clipboard.writeText(text)
    // Show visual feedback
    if (setCopied) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    // Could show error feedback here if needed
  }
}

// Helper function to scroll to anchor with padding (5% of viewport height)
export const scrollToAnchorWithPadding = (hash: string) => {
  if (hash) {
    const element = document.getElementById(hash.substring(1)) // Remove the # symbol
    if (element) {
      const elementTop =
        element.getBoundingClientRect().top + window.pageYOffset
      const offset = window.innerHeight * 0.02 // 2% of viewport height
      const targetPosition = elementTop - offset

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      })
    }
  }
}

export const markdownComponents = {
  h1: ({ children }: any) => {
    const [copied, setCopied] = useState(false)
    const id = children
      ?.toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
    return (
      <h1
        id={id}
        className="text-3xl font-bold text-gray-900 mt-12 mb-8 first:mt-0 group flex items-center gap-2"
      >
        {children}
        <button
          onClick={() =>
            copyToClipboard(
              `${window.location.origin}${window.location.pathname}#${id}`,
              setCopied,
            )
          }
          className={`opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-gray-100 rounded ${
            copied ? 'bg-green-100 opacity-100' : ''
          }`}
          title={copied ? 'Copied!' : 'Copy link to this section'}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Link className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </h1>
    )
  },
  h2: ({ children }: any) => {
    const [copied, setCopied] = useState(false)
    const id = children
      ?.toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
    return (
      <h2
        id={id}
        className="text-2xl font-semibold text-gray-900 mt-10 mb-6 group flex items-center gap-2"
      >
        {children}
        <button
          onClick={() =>
            copyToClipboard(
              `${window.location.origin}${window.location.pathname}#${id}`,
              setCopied,
            )
          }
          className={`opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-gray-100 rounded ${
            copied ? 'bg-green-100 opacity-100' : ''
          }`}
          title={copied ? 'Copied!' : 'Copy link to this section'}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Link className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </h2>
    )
  },
  h3: ({ children }: any) => {
    const [copied, setCopied] = useState(false)
    const id = children
      ?.toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
    return (
      <h3
        id={id}
        className="text-xl font-semibold text-gray-900 mt-8 mb-4 group flex items-center gap-2"
      >
        {children}
        <button
          onClick={() =>
            copyToClipboard(
              `${window.location.origin}${window.location.pathname}#${id}`,
              setCopied,
            )
          }
          className={`opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 hover:bg-gray-100 rounded ${
            copied ? 'bg-green-100 opacity-100' : ''
          }`}
          title={copied ? 'Copied!' : 'Copy link to this section'}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Link className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </h3>
    )
  },
  p: ({ children }: any) => (
    <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside mb-4 space-y-1 ml-4">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside mb-4 space-y-1 ml-4">{children}</ol>
  ),
  li: ({ children }: any) => <li className="mb-2 text-gray-700">{children}</li>,
  strong: ({ children }: any) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }: any) => <em className="italic">{children}</em>,
  a: ({ href, children }: any) => {
    // Check if it's an internal anchor link (starts with #)
    const isInternalAnchor = href?.startsWith('#')

    if (isInternalAnchor) {
      return (
        <a
          href={href}
          className="text-blue-600 hover:text-blue-800 underline"
          onClick={(e) => {
            e.preventDefault()
            scrollToAnchorWithPadding(href)
            // Update URL hash without triggering page reload
            window.history.pushState(null, '', href)
          }}
        >
          {children}
        </a>
      )
    }

    return (
      <a
        href={href}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  },
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
