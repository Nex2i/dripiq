import { createLazyFileRoute } from '@tanstack/react-router'
import { Mail, MessageCircle, Calendar } from 'lucide-react'
import SEOHead from '@/components/shared/SEOHead'
import { APP_URLS } from '@/constants/app'

const ContactPage = () => {
  return (
    <>
      <SEOHead
        title="Contact Us | dripIq - Get Started with AI Sales Re-engagement"
        description="Get in touch with the dripIq team. Schedule a demo, ask questions, or learn how our AI-powered platform can transform your sales process."
        canonical="https://dripiq.ai/contact"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-6">
            Get in <span className="gradient-text">Touch</span>
          </h1>
          <p className="text-xl text-surface-600 max-w-3xl mx-auto">
            Ready to transform your lead re-engagement? Our team is here to help
            you get started with dripIq.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-surface-200">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-4">
              Schedule a Demo
            </h3>
            <p className="text-surface-600 mb-6">
              See dripIq in action with a personalized demo tailored to your
              sales process.
            </p>
            <a
              href="https://calendly.com/dripiq-demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors"
            >
              Book Demo
            </a>
          </div>

          <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-surface-200">
            <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="h-8 w-8 text-accent-600" />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-4">
              Live Chat
            </h3>
            <p className="text-surface-600 mb-6">
              Have a quick question? Chat with our team for immediate
              assistance.
            </p>
            <a
              href="mailto:hello@dripiq.ai"
              className="inline-flex items-center justify-center px-6 py-3 border border-accent-600 text-base font-medium rounded-lg text-accent-600 hover:bg-accent-50 transition-colors"
            >
              Start Chat
            </a>
          </div>

          <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-surface-200">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="h-8 w-8 text-success-600" />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 mb-4">
              Email Us
            </h3>
            <p className="text-surface-600 mb-6">
              Send us a detailed message and we'll get back to you within 24
              hours.
            </p>
            <a
              href="mailto:hello@dripiq.ai"
              className="inline-flex items-center justify-center px-6 py-3 border border-success-600 text-base font-medium rounded-lg text-success-600 hover:bg-success-50 transition-colors"
            >
              Send Email
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-surface-900 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">
                  How quickly can I get started?
                </h3>
                <p className="text-surface-600">
                  Most teams are up and running within 24 hours. Our CRM
                  integration takes just a few clicks to set up.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">
                  Do you offer custom integrations?
                </h3>
                <p className="text-surface-600">
                  Yes! Our enterprise plans include custom workflows with
                  your existing sales stack and CRM systems.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">
                  What kind of support do you provide?
                </h3>
                <p className="text-surface-600">
                  We offer email support for all plans, priority support for Pro
                  users, and dedicated success managers for Enterprise
                  customers.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-50 to-accent-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-surface-900 mb-6">
              Ready to Start?
            </h3>
            <p className="text-surface-600 mb-8">
              Join hundreds of sales teams who have transformed their lead
              re-engagement with dripIq's AI-powered platform.
            </p>
            <div className="space-y-4">
              <a
                href={APP_URLS.SIGNUP}
                className="block w-full text-center py-3 px-6 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors"
              >
                Start Free Trial
              </a>
              <a
                href={APP_URLS.LOGIN}
                className="block w-full text-center py-3 px-6 rounded-lg font-medium text-primary-600 border border-primary-600 hover:bg-primary-50 transition-colors"
              >
                Sign In
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export const Route = createLazyFileRoute('/contact')({
  component: ContactPage,
})
