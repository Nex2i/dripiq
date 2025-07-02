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
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Logo SVG - Neuron Grid Design */}
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
          {/* Background circle */}
          <circle cx="16" cy="16" r="16" fill="url(#backgroundGradient)" />
          
          {/* Neuron Grid Pattern */}
          {/* Primary nodes */}
          <circle cx="8" cy="8" r="1.5" fill="white" opacity="0.7" />
          <circle cx="16" cy="8" r="1.5" fill="white" opacity="0.7" />
          <circle cx="24" cy="8" r="1.5" fill="white" opacity="0.7" />
          
          <circle cx="8" cy="16" r="1.5" fill="white" opacity="0.7" />
          <circle cx="16" cy="16" r="2.5" fill="url(#centerGradient)" className="animate-pulse-glow" />
          <circle cx="24" cy="16" r="1.5" fill="white" opacity="0.7" />
          
          <circle cx="8" cy="24" r="1.5" fill="white" opacity="0.7" />
          <circle cx="16" cy="24" r="1.5" fill="white" opacity="0.7" />
          <circle cx="24" cy="24" r="1.5" fill="white" opacity="0.7" />
          
          {/* Connection lines - creating the neural network effect */}
          <g stroke="white" strokeWidth="0.5" opacity="0.4" fill="none">
            {/* Horizontal connections */}
            <line x1="8" y1="8" x2="16" y2="8" />
            <line x1="16" y1="8" x2="24" y2="8" />
            <line x1="8" y1="16" x2="14" y2="16" />
            <line x1="18" y1="16" x2="24" y2="16" />
            <line x1="8" y1="24" x2="16" y2="24" />
            <line x1="16" y1="24" x2="24" y2="24" />
            
            {/* Vertical connections */}
            <line x1="8" y1="8" x2="8" y2="16" />
            <line x1="8" y1="16" x2="8" y2="24" />
            <line x1="16" y1="8" x2="16" y2="14" />
            <line x1="16" y1="18" x2="16" y2="24" />
            <line x1="24" y1="8" x2="24" y2="16" />
            <line x1="24" y1="16" x2="24" y2="24" />
            
            {/* Diagonal connections for neural network effect */}
            <line x1="8" y1="8" x2="14" y2="14" />
            <line x1="18" y1="14" x2="24" y2="8" />
            <line x1="8" y1="24" x2="14" y2="18" />
            <line x1="18" y1="18" x2="24" y2="24" />
          </g>
          
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#1A1F36' }} />
              <stop offset="50%" style={{ stopColor: '#4361EE' }} />
              <stop offset="100%" style={{ stopColor: '#1A1F36' }} />
            </linearGradient>
            <radialGradient id="centerGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style={{ stopColor: '#FFCB05' }} />
              <stop offset="70%" style={{ stopColor: '#4361EE' }} />
              <stop offset="100%" style={{ stopColor: '#00B894' }} />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Brand text */}
      {showText && (
        <div className="flex items-baseline">
          <span
            className={`font-bold text-brand ${textSizeClasses[size]}`}
            style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}
          >
            drip
          </span>
          <span
            className={`font-bold text-brand-accent ${textSizeClasses[size]}`}
            style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}
          >
            IQ
          </span>
        </div>
      )}
    </div>
  )
}
