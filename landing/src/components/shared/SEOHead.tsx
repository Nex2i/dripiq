import { useEffect } from 'react'

interface SEOProps {
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
  ogType?: string
  keywords?: string[]
  structuredData?: object
}

export default function SEOHead({
  title = 'dripIq - AI-Powered Sales Re-engagement Platform',
  description = 'Automated, intelligent follow-up for your lost leads. AI-powered Salesforce re-engagement platform.',
  canonical = 'https://dripiq.ai/',
  ogImage = 'https://dripiq.ai/android-chrome-512x512.png',
  ogType = 'website',
  keywords = [
    'AI sales',
    'lead re-engagement',
    'Salesforce automation',
    'CRM',
    'sales automation',
  ],
  structuredData,
}: SEOProps) {
  useEffect(() => {
    // Update title
    document.title = title

    // Update meta tags
    const updateMetaTag = (
      name: string,
      content: string,
      isProperty = false,
    ) => {
      const attribute = isProperty ? 'property' : 'name'
      let meta = document.querySelector(`meta[${attribute}="${name}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute(attribute, name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }

    // Basic meta tags
    updateMetaTag('description', description)
    updateMetaTag('keywords', keywords.join(', '))

    // OpenGraph tags
    updateMetaTag('og:title', title, true)
    updateMetaTag('og:description', description, true)
    updateMetaTag('og:type', ogType, true)
    updateMetaTag('og:url', canonical, true)
    updateMetaTag('og:image', ogImage, true)

    // Twitter Card tags
    updateMetaTag('twitter:title', title)
    updateMetaTag('twitter:description', description)
    updateMetaTag('twitter:image', ogImage)

    // Canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]')
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', canonical)

    // Structured data
    if (structuredData) {
      let structuredDataScript = document.querySelector('#structured-data')
      if (!structuredDataScript) {
        structuredDataScript = document.createElement('script')
        structuredDataScript.id = 'structured-data'
        structuredDataScript.setAttribute('type', 'application/ld+json')
        document.head.appendChild(structuredDataScript)
      }
      structuredDataScript.textContent = JSON.stringify(structuredData)
    }
  }, [title, description, canonical, ogImage, ogType, keywords, structuredData])

  return null
}
