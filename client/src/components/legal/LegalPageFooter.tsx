import React from 'react'
import Logo from '../Logo'

interface LegalPageFooterProps {
  maxWidth?: '4xl' | '6xl'
  className?: string
}

const LegalPageFooter: React.FC<LegalPageFooterProps> = ({
  maxWidth = '4xl',
  className = '',
}) => {
  return (
    <div className={`bg-gray-900 py-8 ${className}`}>
      <div className={`max-w-${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex items-center justify-center space-x-2 mb-4">
          <Logo size="sm" showText={true} />
        </div>
        <p className="text-center text-gray-400">
          © 2025 dripIq. Built with ❤️ for sales teams.
        </p>
      </div>
    </div>
  )
}

export default LegalPageFooter
