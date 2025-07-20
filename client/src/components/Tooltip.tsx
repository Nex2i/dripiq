import React, { useState } from 'react'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  className?: string
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap z-10">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

export default Tooltip