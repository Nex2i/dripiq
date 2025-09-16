import { ArrowRight, CheckCircle } from 'lucide-react'
import { APP_URLS } from '@/constants/app'

export default function CTA() {
  const benefits = [
    'Free 14-day trial',
    'No credit card required',
    'Setup in under 5 minutes',
    'Cancel anytime',
  ]

  return (
    <section className="py-20 bg-gradient-to-br from-surface-900 via-surface-800 to-surface-900 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your{' '}
            <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              Sales Pipeline?
            </span>
          </h2>
          <p className="text-xl text-surface-300 max-w-3xl mx-auto">
            Join hundreds of sales teams who have increased their conversion
            rates by 35% with dripIq's AI-powered lead generation platform.
          </p>
        </div>

        {/* Benefits list */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {benefits.map((benefit) => (
            <div
              key={benefit}
              className="flex items-center justify-center space-x-2 text-surface-200"
            >
              <CheckCircle className="h-5 w-5 text-primary-400 flex-shrink-0" />
              <span className="text-sm font-medium">{benefit}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <a
            href={APP_URLS.SIGNUP}
            className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-surface-900 bg-primary-400 hover:bg-primary-300 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 h-5 w-5" />
          </a>
          <a
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-4 border-2 border-surface-600 text-lg font-medium rounded-lg text-surface-200 hover:text-white hover:border-surface-400 transition-all duration-200"
          >
            Talk to Sales
          </a>
        </div>

        {/* Trust indicators */}
        <div className="text-center">
          <p className="text-surface-400 text-sm mb-4">
            Trusted by sales teams at companies like:
          </p>
          <div className="flex flex-wrap justify-center items-center space-x-8 opacity-60">
            {/* Placeholder for customer logos */}
            <div className="text-surface-500 font-semibold text-lg">
              TechCorp
            </div>
            <div className="text-surface-500 font-semibold text-lg">
              Growth Co
            </div>
            <div className="text-surface-500 font-semibold text-lg">
              Scale Inc
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
