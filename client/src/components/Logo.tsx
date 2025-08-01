import logo from '../assets/logo.svg'

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
        <img src={logo} alt="dripIq Logo" className="w-full h-full" />
      </div>

      {/* Brand text */}
      {showText && (
        <span
          className={`font-bold bg-gradient-to-r from-[var(--color-primary-600)] to-[var(--color-primary-800)] bg-clip-text text-transparent ${textSizeClasses[size]}`}
        >
          dripIq
        </span>
      )}
    </div>
  )
}
