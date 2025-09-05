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
        description="Automated, intelligent follow-up for your lost leads. AI-powered CRM re-engagement platform that turns cold leads into warm prospects."
        canonical="https://dripiq.ai/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'dripIq',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description:
            'AI-powered sales re-engagement platform for automated follow-up with lost leads',
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
