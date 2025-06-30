import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const features = [
    {
      icon: '🔄',
      title: 'Closed-Lost Sync',
      description:
        'Native Salesforce integration with real-time and scheduled syncing of closed-lost opportunities.',
    },
    {
      icon: '🤖',
      title: 'AI-Powered Research',
      description:
        'Automated per-lead research and personalized message generation using public web data and Salesforce history.',
    },
    {
      icon: '🧠',
      title: 'Smart Drip Campaigns',
      description:
        'Rules-based and ML-enhanced timing optimization with multi-touch, multi-channel campaigns.',
    },
    {
      icon: '📹',
      title: 'Video & Voice Outreach',
      description:
        'AI script generation with text-to-voice integration and persona-matched content.',
    },
    {
      icon: '📊',
      title: 'Analytics Dashboard',
      description:
        'Campaign performance tracking, revenue recovery metrics, and exportable reports.',
    },
    {
      icon: '🎯',
      title: 'Lead Enrichment',
      description:
        'Advanced filtering by time, product line, deal size, region with custom field mapping.',
    },
  ]

  const stats = [
    { number: '40%', label: 'Average Recovery Rate' },
    { number: '2.5x', label: 'ROI Improvement' },
    { number: '75%', label: 'Time Saved' },
    { number: '500+', label: 'Happy Customers' },
  ]

  const handleContactSales = () => {
    // For now, open email client - can be enhanced with a modal or contact form later
    window.location.href =
      "mailto:sales@dripiq.com?subject=Sales Inquiry&body=Hi, I'm interested in learning more about dripIq."
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation Header */}
      <nav className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Logo size="sm" showText={true} />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleContactSales}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
              >
                Contact Sales
              </button>
              {!user ? (
                <>
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Get Started
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate({ to: '/dashboard' })}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <Logo size="lg" showText={true} className="scale-150" />
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Automated, intelligent follow-up for your{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                lost leads
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform closed-lost leads into high-converting opportunities
              using AI-powered drip campaigns, deep personalized outreach, and
              multi-channel engagement.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!user ? (
                <>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    Start Free Trial
                  </button>
                  <button
                    onClick={handleContactSales}
                    className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-xl text-lg font-semibold border-2 border-gray-200 hover:border-gray-300 transition-all duration-300"
                  >
                    Contact Sales
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate({ to: '/dashboard' })}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-16 h-16 bg-indigo-200 rounded-full opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-purple-200 rounded-full opacity-20 animate-pulse delay-2000"></div>
      </div>

      {/* Stats Section */}
      <div className="bg-white/80 backdrop-blur-sm py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Sales Teams
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to turn lost opportunities into recovered
              revenue
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-white/20"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to recover your lost revenue?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of sales teams already using dripIq to re-engage
            closed-lost leads
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <>
                <button
                  onClick={() => navigate({ to: '/auth/register' })}
                  className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  Start Your Free Trial
                </button>
                <button
                  onClick={handleContactSales}
                  className="bg-transparent hover:bg-white/10 text-white px-8 py-4 rounded-xl text-lg font-semibold border-2 border-white hover:border-gray-200 transition-all duration-300"
                >
                  Contact Sales
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate({ to: '/dashboard' })}
                className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Logo size="sm" showText={true} />
          </div>
          <div className="flex justify-center space-x-6 mb-4">
            <button
              onClick={handleContactSales}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              Contact Sales
            </button>
            {!user && (
              <>
                <button
                  onClick={() => navigate({ to: '/auth/login' })}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate({ to: '/auth/register' })}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
          <p className="text-center text-gray-400">
            © 2024 dripIq. Built with ❤️ for sales teams.
          </p>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
