import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import Logo from '../Logo'

interface LegalPageHeaderProps {
  maxWidth?: '4xl' | '6xl'
  className?: string
}

const LegalPageHeader: React.FC<LegalPageHeaderProps> = ({
  maxWidth = '4xl',
  className = '',
}) => {
  const navigate = useNavigate()
  const baseUrl = import.meta.env.VITE_APP_URL || '/'

  const handleBackToHome = () => {
    // Check if baseUrl is an external URL (different domain/port)
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      try {
        const url = new URL(baseUrl)
        const currentUrl = new URL(window.location.href)

        // If it's a different domain or port, use window.location for external redirect
        if (
          url.hostname !== currentUrl.hostname ||
          url.port !== currentUrl.port
        ) {
          window.location.href = baseUrl
          return
        }
      } catch (error) {
        // If URL parsing fails, fall back to window.location
        window.location.href = baseUrl
        return
      }
    }

    // For internal routes or relative paths, use router navigation
    navigate({ to: baseUrl })
  }

  return (
    <div className={`bg-white shadow-sm border-b ${className}`}>
      <div className={`max-w-${maxWidth} mx-auto px-4 sm:px-6 lg:px-8 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Logo size="sm" showText={true} />
          </div>
          <button
            onClick={handleBackToHome}
            className="text-sm text-gray-500 hover:text-gray-700 underline bg-transparent border-none cursor-pointer inline-flex items-center"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

export default LegalPageHeader
