import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    // Redirect to the main client application
    if (typeof window !== 'undefined') {
      window.location.href = 'https://app.dripiq.ai/login'
    }
  },
  component: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-4">Redirecting to Login...</h1>
        <p className="text-surface-600">
          If you are not redirected automatically,{' '}
          <a 
            href="https://app.dripiq.ai/login" 
            className="text-primary-600 hover:text-primary-700 underline"
          >
            click here
          </a>
          .
        </p>
      </div>
    </div>
  ),
})
