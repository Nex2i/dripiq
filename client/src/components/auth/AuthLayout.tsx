import Logo from '../Logo'

interface AuthLayoutProps {
  children: React.ReactNode
}

/**
 * Reusable layout component for authentication pages
 * Follows Single Responsibility Principle - only handles consistent auth page styling
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-[var(--color-primary-50)] to-[var(--color-primary-100)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex justify-center mb-6">
          <Logo size="lg" showText={true} />
        </div>
        {children}
      </div>
    </div>
  )
}
