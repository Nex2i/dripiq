import { Brain, Zap, Target, BarChart3, Puzzle } from 'lucide-react'
import { APP_URLS } from '@/constants/app'

export default function Features() {
  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Lead Scoring',
      description:
        'Our machine learning algorithms analyze lead behavior patterns to identify the best candidates for re-engagement.',
      gradient: 'from-primary-500 to-primary-600',
    },
    {
      icon: Zap,
      title: 'Automated Outreach',
      description:
        'Set up personalized email sequences that adapt based on lead responses and engagement levels.',
      gradient: 'from-accent-500 to-accent-600',
    },
    {
      icon: Target,
      title: 'Smart Targeting',
      description:
        'Target leads based on their stage in the sales funnel, industry, company size, and previous interactions.',
      gradient: 'from-primary-600 to-accent-500',
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      description:
        'Track campaign performance, conversion rates, and ROI with detailed analytics and reporting.',
      gradient: 'from-success-500 to-success-600',
    },
    {
      icon: Puzzle,
      title: 'Seamless Integration',
      description:
        'Easy integration with your existing CRM and sales tools. Works with your current sales stack.',
      gradient: 'from-accent-600 to-primary-500',
    },
  ]

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-surface-900 mb-6">
            Powerful Features for{' '}
            <span className="gradient-text">Modern Sales Teams</span>
          </h2>
          <p className="text-xl text-surface-600 max-w-3xl mx-auto">
            Everything you need to turn your dormant leads into active prospects
            with AI-powered automation and intelligent insights.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative p-8 bg-white rounded-2xl border border-surface-200 hover:border-primary-200 transition-all duration-300 hover:shadow-xl"
              >
                {/* Icon */}
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${feature.gradient} mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-surface-900 mb-4 group-hover:text-primary-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-surface-600 leading-relaxed">
                  {feature.description}
                </p>

                {/* Hover effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-accent-50/0 group-hover:from-primary-50/50 group-hover:to-accent-50/50 rounded-2xl transition-all duration-300 -z-10"></div>
              </div>
            )
          })}
        </div>

        {/* Additional info section */}
        <div className="mt-20 text-center bg-gradient-to-r from-primary-50 to-accent-50 rounded-2xl p-12">
          <h3 className="text-2xl md:text-3xl font-bold text-surface-900 mb-6">
            Ready to See These Features in Action?
          </h3>
          <p className="text-surface-600 mb-8 max-w-2xl mx-auto">
            Join thousands of sales professionals who have transformed their
            lead re-engagement strategy with dripIq's AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={APP_URLS.SIGNUP}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 border border-primary-600 text-base font-medium rounded-lg text-primary-600 bg-white hover:bg-primary-50 transition-colors"
            >
              Schedule Demo
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
