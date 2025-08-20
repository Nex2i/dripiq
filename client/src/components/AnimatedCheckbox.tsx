import React from 'react'
import { CheckSquare, Square } from 'lucide-react'

interface AnimatedCheckboxProps {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  loading?: boolean
  label: string
  title?: string
  className?: string
}

const AnimatedCheckbox: React.FC<AnimatedCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  loading = false,
  label,
  title,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled || loading}
      className={`flex items-center space-x-2 px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={title}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
      ) : checked ? (
        <CheckSquare className="h-4 w-4 text-green-600" />
      ) : (
        <Square className="h-4 w-4 text-gray-400" />
      )}
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  )
}

export default AnimatedCheckbox
