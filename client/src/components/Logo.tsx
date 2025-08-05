// @ts-ignore SVG import with ?react suffix not recognized by TypeScript
// import LogoImg from '../assets/logo.svg?react'
import LogoImg from '../assets/logo.png'

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
      {/* Logo SVG */}
      <img
        src={LogoImg}
        alt="Logo"
        className={`${sizeClasses[size]} flex-shrink-0`}
      />

      {/* Brand text */}
      {showText && (
        <span
          className={`font-bold bg-gradient-to-r from-[var(--color-accent-500)] to-[var(--color-primary-600)] bg-clip-text text-transparent ${textSizeClasses[size]}`}
        >
          dripIq
        </span>
      )}
    </div>
  )
}
