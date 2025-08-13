import { useNavigate } from '@tanstack/react-router'
import Logo from '../components/Logo'

function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Logo size="sm" showText={true} />
            </div>
            <button
              onClick={() => navigate({ to: '/' })}
              className="text-sm text-gray-500 hover:text-gray-700 underline bg-transparent border-none cursor-pointer inline-flex items-center"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm border p-8 lg:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">About dripIq</h1>
          <p className="mb-4 text-gray-700 leading-relaxed">
            dripIq helps revenue teams automatically re-engage closed-lost opportunities.
            We combine native Salesforce syncing, AI-powered research, and multi-channel
            outreach to craft relevant, personalized follow-ups that convert dormant deals
            into pipeline.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">What we do</h2>
          <ul className="list-disc list-inside mb-6 space-y-2 ml-4 text-gray-700">
            <li>Sync and segment your closed-lost opportunities from Salesforce</li>
            <li>Research accounts and contacts using trustworthy public data</li>
            <li>Generate tailored multi-touch, multi-channel drip sequences</li>
            <li>Track outcomes with a clear analytics dashboard</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">Who it’s for</h2>
          <p className="mb-4 text-gray-700 leading-relaxed">
            Sales, marketing, and revenue operations teams who want a reliable, compliant,
            and scalable way to revive lost opportunities and recover revenue.
          </p>

          <div className="mt-10 p-6 rounded-xl bg-gray-50 border">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Why teams choose dripIq</h3>
            <p className="text-gray-700">
              Our approach is simple: connect securely, enrich responsibly, personalize messages,
              and measure impact. No spam. Just thoughtful follow-up at scale.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Logo size="sm" showText={true} />
          </div>
          <p className="text-center text-gray-400">© 2025 dripIq. Built with ❤️ for sales teams.</p>
        </div>
      </div>
    </div>
  )
}

export default AboutPage