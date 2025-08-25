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
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto',
    lg: 'h-12 w-auto',
  }

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl',
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Logo placeholder - you can replace with actual logo */}
      <div
        className={`${sizeClasses[size]} aspect-square bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center flex-shrink-0`}
      >
        <span className="text-white font-bold text-sm">dIq</span>
      </div>

      {/* Brand text */}
      {showText && (
        <span className={`font-bold gradient-text ${textSizeClasses[size]}`}>
          dripIq
        </span>
      )}
    </div>
  )
}
