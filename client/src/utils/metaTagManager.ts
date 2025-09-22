/**
 * Dynamic meta tag management for Open Graph and other social media previews
 */

interface MetaTagConfig {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: string
  siteName?: string
}

export class MetaTagManager {
  private static instance: MetaTagManager
  private originalTags: Map<string, string> = new Map()

  private constructor() {}

  static getInstance(): MetaTagManager {
    if (!MetaTagManager.instance) {
      MetaTagManager.instance = new MetaTagManager()
    }
    return MetaTagManager.instance
  }

  /**
   * Store original meta tag values for restoration
   */
  private storeOriginalTag(name: string, content: string | null) {
    if (content && !this.originalTags.has(name)) {
      this.originalTags.set(name, content)
    }
  }

  /**
   * Update a meta tag
   */
  private updateMetaTag(
    name: string,
    content: string | null,
    property = false,
  ) {
    const selector = property
      ? `meta[property="${name}"]`
      : `meta[name="${name}"]`
    const element = document.querySelector(selector) as HTMLMetaElement

    if (element) {
      if (content) {
        this.storeOriginalTag(name, element.content)
        element.content = content
      } else if (this.originalTags.has(name)) {
        element.content = this.originalTags.get(name)!
      }
    }
  }

  /**
   * Set meta tags for a lead page
   */
  setLeadMetaTags(config: MetaTagConfig) {
    const {
      title,
      description = 'Lead details and contact information',
      image,
      url,
      type = 'website',
      siteName = 'dripIq',
    } = config

    // Update title
    if (title) {
      document.title = title
    }

    // Update meta description
    this.updateMetaTag('description', description)

    // Update Open Graph tags
    this.updateMetaTag('og:title', title || document.title, true)
    this.updateMetaTag('og:description', description, true)
    if (image) {
      this.updateMetaTag('og:image', image, true)
    }
    this.updateMetaTag('og:url', url || window.location.href, true)
    this.updateMetaTag('og:type', type, true)
    this.updateMetaTag('og:site_name', siteName, true)

    // Update Twitter Card tags
    this.updateMetaTag('twitter:title', title || document.title)
    this.updateMetaTag('twitter:description', description)
    if (image) {
      this.updateMetaTag('twitter:image', image)
    }
    this.updateMetaTag('twitter:card', 'summary_large_image')
  }

  /**
   * Restore original meta tags
   */
  restoreOriginalTags() {
    // Restore title
    if (this.originalTags.has('title')) {
      document.title = this.originalTags.get('title')!
    }

    // Restore meta tags
    this.originalTags.forEach((content, name) => {
      if (name === 'title') return // Already handled above
      this.updateMetaTag(name, content)
    })

    // Clear stored original tags
    this.originalTags.clear()
  }

  /**
   * Set generic app meta tags
   */
  setDefaultMetaTags() {
    // Use environment-appropriate image URL
    const appUrl = import.meta.env.VITE_APP_URL || 'https://dripiq.ai'
    const imageUrl = `${appUrl}/android-chrome-512x512.png`

    this.setLeadMetaTags({
      title: 'dripIq - AI-Powered Sales Re-engagement Platform',
      description:
        'dripIq - Automated, intelligent follow-up for your lost leads. AI-powered Salesforce re-engagement platform.',
      image: imageUrl,
      url: appUrl + '/',
      siteName: 'dripIq',
    })
  }
}

// Export singleton instance
export const metaTagManager = MetaTagManager.getInstance()
