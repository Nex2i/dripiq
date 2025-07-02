interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export default function Logo({
  size = 'md',
  showText = true,
  className = '',
}: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Logo SVG */}
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
          {/* Background circle with gradient */}
          <circle cx="16" cy="16" r="16" fill="url(#gradient)" />

          {/* Drip/funnel shape */}
          <path d="M16 6 L20 12 L16 18 L12 12 Z" fill="white" opacity="0.9" />

          {/* AI brain/circuit pattern */}
          <circle cx="13" cy="22" r="1.5" fill="white" opacity="0.8" />
          <circle cx="19" cy="22" r="1.5" fill="white" opacity="0.8" />
          <circle cx="16" cy="25" r="1" fill="white" opacity="0.6" />

          {/* Connection lines representing AI */}
          <path
            d="M13 22 L16 25 L19 22"
            stroke="white"
            strokeWidth="0.5"
            opacity="0.6"
            fill="none"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="[stop-color:theme(colors.primary.500)]" />
              <stop offset="50%" className="[stop-color:theme(colors.primary.700)]" />
              <stop offset="100%" className="[stop-color:theme(colors.primary.800)]" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand text */}
      {showText && (
        <span
          className={`font-bold bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent ${textSizeClasses[size]}`}
        >
          dripIq
        </span>
      )}
    </div>
  )
}
