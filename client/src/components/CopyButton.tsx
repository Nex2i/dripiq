import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className = '',
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label || 'text'}`}
      className={`inline-flex items-center justify-center p-1.5 rounded-md text-gray-400 hover:text-[var(--color-primary-600)] hover:bg-gray-50 transition-colors ${className}`}
    >
      {isCopied ? (
        <Check className="h-4 w-4 text-green-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}

export default CopyButton
