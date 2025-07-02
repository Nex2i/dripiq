import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'
import ContactSalesModal from '../components/ContactSalesModal'

function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

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
    setIsContactModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gradient-hero-from via-gradient-hero-via to-gradient-hero-to">
      {/* Navigation Header */}
      <nav className="relative z-10 bg-surface-elevated backdrop-blur-sm border-b border-border-primary/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Logo size="sm" showText={true} />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleContactSales}
                className="text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg hover:bg-neutral-100 transition-all duration-200"
              >
                Contact Sales
              </button>
              {!user ? (
                <>
                  <button
                    onClick={() => navigate({ to: '/auth/login' })}
                    className="text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg hover:bg-neutral-100 transition-all duration-200"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Get Started
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate({ to: '/dashboard' })}
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
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

            <h1 className="text-4xl md:text-6xl font-bold text-text-primary mb-6">
              Automated, intelligent follow-up for your{' '}
              <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                lost leads
              </span>
            </h1>

            <p className="text-xl text-text-secondary mb-8 max-w-3xl mx-auto">
              Transform closed-lost leads into high-converting opportunities
              using AI-powered drip campaigns, deep personalized outreach, and
              multi-channel engagement.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              {!user ? (
                <>
                  <button
                    onClick={() => navigate({ to: '/auth/register' })}
                    className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    Start Your Free Trial
                  </button>
                  <button
                    onClick={handleContactSales}
                    className="bg-surface-primary hover:bg-neutral-50 text-text-primary px-8 py-4 rounded-xl text-lg font-semibold border-2 border-border-primary hover:border-border-secondary transition-all duration-300"
                  >
                    Contact Sales
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate({ to: '/dashboard' })}
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-text-inverse px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Floating animated elements */}
        <div className="absolute top-20 left-8 w-16 h-16 bg-primary-200 rounded-full opacity-20 animate-float-horizontal"></div>
        <div className="absolute bottom-20 right-8 w-12 h-12 bg-secondary-200 rounded-full opacity-25 animate-float-vertical"></div>
        <div className="absolute top-32 right-16 w-10 h-10 bg-success-200 rounded-full opacity-15 animate-float-diagonal"></div>
        <div className="absolute bottom-32 left-16 w-14 h-14 bg-warning-200 rounded-full opacity-20 animate-float-circular"></div>
        <div className="absolute top-1/2 left-1/4 w-8 h-8 bg-error-200 rounded-full opacity-15 animate-float-gentle"></div>
        <div className="absolute top-1/3 right-1/3 w-12 h-12 bg-neutral-300 rounded-full opacity-20 animate-float-swing"></div>
        <div className="absolute top-1/2 right-1/4 w-14 h-14 bg-primary-300 rounded-full opacity-15 animate-float-gentle"></div>
        <div className="absolute bottom-1/3 right-8 w-18 h-18 bg-secondary-300 rounded-full opacity-20 animate-float-wave"></div>
        <div className="absolute top-1/3 left-1/3 w-10 h-10 bg-success-300 rounded-full opacity-25 animate-float-horizontal delay-[2s]"></div>
        <div className="absolute bottom-1/2 left-16 w-8 h-8 bg-warning-300 rounded-full opacity-20 animate-float-gentle delay-[4s]"></div>
        <div className="absolute top-3/4 right-1/3 w-22 h-22 bg-error-300 rounded-full opacity-15 animate-float-diagonal delay-[1s]"></div>
      </div>

      {/* Stats Section */}
      <div className="bg-surface-elevated backdrop-blur-sm py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary-500 mb-2">
                  {stat.number}
                </div>
                <div className="text-text-secondary font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-surface-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Intelligent Lead Recovery Platform
            </h2>
            <p className="text-xl text-text-secondary max-w-3xl mx-auto">
              Our AI-powered platform helps you re-engage lost leads with
              personalized, multi-channel campaigns that convert.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-surface-secondary p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-border-primary"
              >
                <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center mb-6">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-4">
                  {feature.title}
                </h3>
                <p className="text-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-500 to-secondary-500 py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-text-inverse mb-6">
            Ready to recover your lost revenue?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join hundreds of sales teams already using dripIq to re-engage
            closed-lost leads
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <>
                <button
                  onClick={() => navigate({ to: '/auth/register' })}
                  className="bg-surface-primary hover:bg-neutral-100 text-primary-500 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                >
                  Start Your Free Trial
                </button>
                <button
                  onClick={handleContactSales}
                  className="bg-transparent hover:bg-white/10 text-text-inverse px-8 py-4 rounded-xl text-lg font-semibold border-2 border-white hover:border-neutral-200 transition-all duration-300"
                >
                  Contact Sales
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate({ to: '/dashboard' })}
                className="bg-surface-primary hover:bg-neutral-100 text-primary-500 px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-neutral-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Logo size="sm" showText={true} />
          </div>
          <div className="flex justify-center space-x-6 mb-4">
            <button
              onClick={handleContactSales}
              className="text-neutral-400 hover:text-text-inverse transition-colors duration-200"
            >
              Contact Sales
            </button>
            {!user && (
              <>
                <button
                  onClick={() => navigate({ to: '/auth/login' })}
                  className="text-neutral-400 hover:text-text-inverse transition-colors duration-200"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate({ to: '/auth/register' })}
                  className="text-neutral-400 hover:text-text-inverse transition-colors duration-200"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
          <p className="text-center text-neutral-400">
            © 2025 dripIq. Built with ❤️ for sales teams.
          </p>
        </div>
      </div>

      {/* Contact Sales Modal */}
      <ContactSalesModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </div>
  )
}

export default LandingPage
