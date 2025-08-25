import { createLazyFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import SEOHead from '@/components/shared/SEOHead'

const PricingPage = () => {
  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      description: 'Perfect for small teams getting started',
      features: [
        'Up to 100 leads per month',
        'Basic AI re-engagement',
        'Email support',
        'Salesforce integration',
      ],
      cta: 'Start Free',
      href: 'https://app.dripiq.ai/signup',
      popular: false,
    },
    {
      name: 'Professional',
      price: '$99',
      period: '/month',
      description: 'For growing sales teams',
      features: [
        'Up to 1,000 leads per month',
        'Advanced AI targeting',
        'Multi-channel outreach',
        'Priority support',
        'Custom templates',
        'Analytics dashboard',
      ],
      cta: 'Start Trial',
      href: 'https://app.dripiq.ai/signup?plan=pro',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations',
      features: [
        'Unlimited leads',
        'Custom AI models',
        'Dedicated success manager',
        'White-label options',
        'API access',
        'Custom integrations',
      ],
      cta: 'Contact Sales',
      href: '/contact',
      popular: false,
    },
  ]

  return (
    <>
      <SEOHead
        title="Pricing Plans | dripIq - AI Sales Re-engagement Platform"
        description="Choose the perfect dripIq plan for your sales team. From free starter plans to enterprise solutions for AI-powered lead re-engagement."
        canonical="https://dripiq.ai/pricing"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-6">
            Simple, Transparent <span className="gradient-text">Pricing</span>
          </h1>
          <p className="text-xl text-surface-600 max-w-3xl mx-auto">
            Choose the plan that fits your team size and re-engagement goals.
            Start free and scale as you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 ${
                plan.popular
                  ? 'border-2 border-primary-500 bg-primary-50 shadow-xl'
                  : 'border border-surface-200 bg-white shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-surface-900 mb-2">
                  {plan.name}
                </h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-surface-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-surface-600">{plan.period}</span>
                  )}
                </div>
                <p className="text-surface-600">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center">
                    <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                    <span className="text-surface-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`block w-full text-center py-3 px-6 rounded-lg font-medium transition-colors ${
                  plan.popular
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-surface-100 text-surface-900 hover:bg-surface-200'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="text-center bg-surface-50 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-surface-900 mb-6">
            Need a Custom Solution?
          </h2>
          <p className="text-surface-600 mb-8 max-w-2xl mx-auto">
            We work with enterprise teams to create custom AI models and
            integrations that fit your unique sales process.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 transition-colors"
          >
            Contact Our Team
          </a>
        </div>
      </div>
    </>
  )
}

export const Route = createLazyFileRoute('/pricing')({
  component: PricingPage,
})
