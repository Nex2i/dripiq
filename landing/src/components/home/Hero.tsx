import { ArrowRight, Play } from 'lucide-react'
import { APP_URLS } from '@/constants/app'

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-primary-50 via-white to-accent-50 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-200 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <div className="mb-8">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800 mb-6">
                ✨ AI-Powered Sales Re-engagement
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-surface-900 leading-tight">
                Turn Lost Leads Into{' '}
                <span className="gradient-text">Warm Prospects</span>
              </h1>
              <p className="text-xl text-surface-600 mt-6 max-w-2xl mx-auto lg:mx-0">
                dripIq uses AI to automatically identify dormant leads in your
                Salesforce and orchestrate personalized re-engagement campaigns
                that actually convert.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <a
                href={APP_URLS.SIGNUP}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 border border-surface-300 text-base font-medium rounded-lg text-surface-700 bg-white hover:bg-surface-50 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </a>
            </div>

            {/* Social proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start text-sm text-surface-600 space-y-2 sm:space-y-0 sm:space-x-6">
              <div className="flex items-center">
                <span className="font-semibold text-surface-900">500+</span>
                <span className="ml-1">sales teams</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-surface-900">2M+</span>
                <span className="ml-1">leads re-engaged</span>
              </div>
              <div className="flex items-center">
                <span className="font-semibold text-surface-900">35%</span>
                <span className="ml-1">average conversion lift</span>
              </div>
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            {/* Placeholder for hero image/video */}
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border border-surface-200">
              {/* Mock dashboard UI */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-primary-200 rounded"></div>
                  <div className="h-3 w-16 bg-surface-200 rounded"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-2 w-full bg-surface-100 rounded"></div>
                  <div className="h-2 w-3/4 bg-surface-100 rounded"></div>
                  <div className="h-2 w-1/2 bg-surface-100 rounded"></div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <div className="h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center">
                    <div className="text-xs font-semibold text-primary-700">
                      AI Score: 94
                    </div>
                  </div>
                  <div className="h-16 bg-gradient-to-br from-accent-100 to-accent-200 rounded-lg flex items-center justify-center">
                    <div className="text-xs font-semibold text-accent-700">
                      Engaged
                    </div>
                  </div>
                  <div className="h-16 bg-gradient-to-br from-success-100 to-success-200 rounded-lg flex items-center justify-center">
                    <div className="text-xs font-semibold text-success-700">
                      +35%
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center shadow-lg animate-pulse-glow">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <div className="absolute -bottom-4 -left-4 w-10 h-10 bg-accent-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-xs">📈</span>
              </div>
            </div>

            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-200/20 to-accent-200/20 rounded-2xl blur-xl -z-10 scale-110"></div>
          </div>
        </div>
      </div>
    </section>
  )
}
