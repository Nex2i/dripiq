import { XCircle } from 'lucide-react'

interface ErrorDisplayProps {
  error: string
  className?: string
}

/**
 * Reusable error display component
 * Follows Single Responsibility Principle - only handles error display
 */
export default function ErrorDisplay({
  error,
  className = '',
}: ErrorDisplayProps) {
  if (!error) return null

  return (
    <div
      className={`rounded-xl bg-red-50 p-4 border border-red-200 ${className}`}
    >
      <div className="flex items-center">
        <XCircle className="w-4 h-4 mr-2 text-red-600 flex-shrink-0" />
        <div className="text-sm text-red-700">{error}</div>
      </div>
    </div>
  )
}
