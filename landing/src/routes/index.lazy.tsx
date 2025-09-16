import { createLazyFileRoute } from '@tanstack/react-router'
import Hero from '@/components/home/Hero'
import Features from '@/components/home/Features'
import CTA from '@/components/home/CTA'
import SEOHead from '@/components/shared/SEOHead'

const HomePage = () => {
  return (
    <>
      <SEOHead
        title="dripIq - AI-Powered Sales Re-engagement Platform"
        description="Automated lead generation and nurturing for cold leads, net new prospects, and closed lost opportunities. AI-powered CRM platform that transforms your entire lead pipeline."
        canonical="https://dripiq.ai/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'dripIq',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description:
            'AI-powered lead generation platform for cold outreach, net new prospects, and closed lost recovery',
          url: 'https://dripiq.ai/',
          screenshot: 'https://dripiq.ai/app-screenshot.jpg',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        }}
      />
      <div className="space-y-0">
        <Hero />
        <Features />
        <CTA />
      </div>
    </>
  )
}

export const Route = createLazyFileRoute('/')({
  component: HomePage,
})
