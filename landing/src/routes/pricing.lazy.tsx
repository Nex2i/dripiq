import { createLazyFileRoute } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import SEOHead from '@/components/shared/SEOHead'
import { APP_URLS } from '@/constants/app'

const PricingPage = () => {
  const plans = [
    {
      name: 'Starter',
      price: '$250',
      period: '/month',
      tokenPrice: '$2.50',
      leads: '100',
      description: 'Perfect for small teams getting started',
      features: [
        'Up to 100 prospects per month',
        '$2.50 per token (1 token = 1 prospect)',
        'Basic AI lead generation',
        'Email support',
        'CRM integration',
      ],
      cta: 'Get Started',
      href: APP_URLS.SIGNUP,
      popular: false,
    },
    {
      name: 'Growth',
      price: '$500',
      period: '/month',
      tokenPrice: '$2.00',
      leads: '250',
      description: 'For growing sales teams',
      features: [
        'Up to 250 prospects per month',
        '$2.00 per token (1 token = 1 prospect)',
        'Advanced AI lead scoring',
        'Multi-channel cold outreach',
        'Priority support',
        'Custom templates',
      ],
      cta: 'Get Started',
      href: APP_URLS.SIGNUP,
      popular: true,
    },
    {
      name: 'Professional',
      price: '$750',
      period: '/month',
      tokenPrice: '$1.50',
      leads: '500',
      description: 'For established sales teams',
      features: [
        'Up to 500 prospects per month',
        '$1.50 per token (1 token = 1 prospect)',
        'Advanced AI lead scoring',
        'Multi-channel cold outreach',
        'Priority support',
        'Analytics dashboard',
        'Custom templates',
      ],
      cta: 'Get Started',
      href: APP_URLS.SIGNUP,
      popular: false,
    },
    {
      name: 'Scale',
      price: '$1,000',
      period: '/month',
      tokenPrice: '$1.00',
      leads: '1,000',
      description: 'For high-volume sales operations',
      features: [
        'Up to 1,000 prospects per month',
        '$1.00 per token (1 token = 1 prospect)',
        'Advanced AI lead scoring',
        'Multi-channel cold outreach',
        'Priority support',
        'Analytics dashboard',
        'Custom workflows',
        'API access',
      ],
      cta: 'Get Started',
      href: APP_URLS.SIGNUP,
      popular: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large organizations with custom needs',
      features: [
        'Custom prospect volumes',
        'Custom AI models',
        'Dedicated success manager',
        'White-label options',
        'Full API access',
        'Custom integrations',
        'SLA guarantees',
      ],
      cta: 'Contact Sales',
      href: '/contact',
      popular: false,
    },
  ]

  const tokenBundles = [
    {
      name: 'Token Bundle - Small',
      tokens: '10',
      price: '$27.50',
      tokenPrice: '$2.75',
      description: 'Perfect for occasional campaigns',
      rollover: true,
    },
    {
      name: 'Token Bundle - Medium',
      tokens: '100',
      price: '$250',
      tokenPrice: '$2.50',
      description: 'Great for regular campaigns',
      rollover: true,
    },
  ]

  return (
    <>
      <SEOHead
        title="Token-Based Pricing | dripIq - AI Sales Re-engagement Platform"
        description="Pay per prospect with dripIq's token-based pricing. 1 token = 1 prospect. Generate cold leads, discover net new opportunities, and recover closed lost deals. Starting at $250/month."
        canonical="https://dripiq.ai/pricing"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-surface-900 mb-6">
            Token-Based <span className="gradient-text">Pricing</span>
          </h1>
          <p className="text-xl text-surface-600 max-w-3xl mx-auto mb-4">
            Pay only for the prospects you engage. 1 token = 1 prospect.
            Generate cold leads, find net new opportunities, and recover closed
            lost deals.
          </p>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-lg font-semibold text-green-800 text-center">
              💰 We charge $250 for every sale closed brought in by DripIQ
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 md:grid-cols-2 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col h-full ${
                plan.popular
                  ? 'border-2 border-primary-500 bg-primary-50 shadow-xl'
                  : 'border border-surface-200 bg-white shadow-lg'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10 flex justify-center w-full">
                  <span className="bg-primary-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-surface-900 mb-2">
                  {plan.name}
                </h3>
                <div className="mb-2">
                  <span className="text-3xl font-bold text-surface-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-surface-600">{plan.period}</span>
                  )}
                </div>
                {plan.tokenPrice && (
                  <div className="text-sm text-primary-600 font-medium mb-2">
                    {plan.tokenPrice} per token
                  </div>
                )}
                <p className="text-sm text-surface-600">{plan.description}</p>
              </div>

              <ul className="space-y-2 mb-8 flex-grow">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="h-4 w-4 text-primary-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-surface-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className={`block w-full text-center py-3 px-6 rounded-lg font-medium transition-colors mt-auto ${
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

        <div className="mb-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-surface-900 mb-4">
              Token Bundles
            </h2>
            <p className="text-lg text-surface-600 max-w-2xl mx-auto">
              Need more flexibility? Buy token bundles that roll over month to
              month. Perfect for irregular campaigns or supplementing your
              monthly plan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {tokenBundles.map((bundle) => (
              <div
                key={bundle.name}
                className="border border-surface-200 bg-white shadow-lg rounded-2xl p-8 flex flex-col h-full"
              >
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-surface-900 mb-2">
                    {bundle.name}
                  </h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-surface-900">
                      {bundle.price}
                    </span>
                  </div>
                  <div className="text-sm text-primary-600 font-medium mb-2">
                    {bundle.tokenPrice} per token
                  </div>
                  <p className="text-surface-600">{bundle.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                    <span className="text-surface-700">
                      {bundle.tokens} tokens included
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                    <span className="text-surface-700">
                      Tokens roll over monthly
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                    <span className="text-surface-700">
                      Use anytime, no expiration
                    </span>
                  </li>
                  <li className="flex items-center">
                    <Check className="h-5 w-5 text-primary-500 mr-3 flex-shrink-0" />
                    <span className="text-surface-700">
                      Perfect for campaign bursts
                    </span>
                  </li>
                </ul>

                <a
                  href={APP_URLS.SIGNUP}
                  className="block w-full text-center py-3 px-6 rounded-lg font-medium transition-colors bg-surface-100 text-surface-900 hover:bg-surface-200 mt-auto"
                >
                  Purchase Bundle
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16 bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl p-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-surface-900 mb-4">
              Important: Token Usage Policy
            </h3>
            <div className="max-w-3xl mx-auto text-surface-700 space-y-2">
              <p>
                • Monthly plan tokens do not roll over - use them or lose them
                each month
              </p>
              <p>
                • Token bundles roll over indefinitely - perfect for irregular
                usage
              </p>
              <p>
                • 1 token = 1 prospect engagement across all AI lead generation
                features
              </p>
              <p>
                • All plans include full access to our AI lead generation
                platform
              </p>
              <p className="text-green-700 font-medium">
                • Success fee: $250 charged per sale closed brought in by DripIQ
              </p>
            </div>
          </div>
        </div>

        <div className="text-center bg-surface-50 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-surface-900 mb-6">
            Need a Custom Solution?
          </h2>
          <p className="text-surface-600 mb-8 max-w-2xl mx-auto">
            We work with enterprise teams to create custom AI models and
            workflows that fit your unique sales process.
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
