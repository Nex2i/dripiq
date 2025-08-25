import { createLazyFileRoute } from '@tanstack/react-router'
import SEOHead from '@/components/shared/SEOHead'

const AboutPage = () => {
  return (
    <>
      <SEOHead
        title="About dripIq - AI Sales Automation Leaders"
        description="Learn about dripIq's mission to revolutionize sales re-engagement through AI-powered automation. Discover our story and team."
        canonical="https://dripiq.ai/about"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-6">
            About <span className="gradient-text">dripIq</span>
          </h1>
          <p className="text-xl text-surface-600 max-w-3xl mx-auto">
            We're revolutionizing how sales teams re-engage with lost leads
            through AI-powered automation and intelligent follow-up strategies.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold text-surface-900 mb-6">
              Our Mission
            </h2>
            <p className="text-surface-600 mb-4">
              Every sales team loses leads. But what if those "lost" leads could
              become your biggest wins? At dripIq, we believe that intelligent,
              automated re-engagement can transform your sales pipeline.
            </p>
            <p className="text-surface-600">
              Our AI-powered platform integrates seamlessly with Salesforce to
              identify dormant leads and orchestrate personalized re-engagement
              campaigns that actually convert.
            </p>
          </div>
          <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl p-8">
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">🎯</span>
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900">
                    Smart Targeting
                  </h3>
                  <p className="text-surface-600 text-sm">
                    AI identifies the best leads to re-engage
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-accent-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">⚡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900">
                    Automated Outreach
                  </h3>
                  <p className="text-surface-600 text-sm">
                    Personalized campaigns that feel human
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">📈</span>
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900">
                    Proven Results
                  </h3>
                  <p className="text-surface-600 text-sm">
                    Turn cold leads into warm prospects
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center bg-surface-50 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-surface-900 mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-surface-600 mb-8 max-w-2xl mx-auto">
            Join hundreds of sales teams who have transformed their lead
            re-engagement with dripIq's AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={import.meta.env.VITE_APP_URL + '/signup'}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              Start Free Trial
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 border border-primary-600 text-base font-medium rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
            >
              Contact Sales
            </a>
          </div>
        </div>
      </div>
    </>
  )
}

export const Route = createLazyFileRoute('/about')({
  component: AboutPage,
})
