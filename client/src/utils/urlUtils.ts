/**
 * URL utility functions that match the backend string extensions
 */

/**
 * Get the full domain of a website URL including TLD, without protocol or www
 * Matches backend getFullDomain() extension
 */
export const getFullDomain = (url: string): string => {
  if (!url || url.trim() === '') return ''

  let processedUrl = url.toString()

  // Remove protocol
  processedUrl = processedUrl.replace(/^https?:\/\//, '')

  // Remove www prefix
  processedUrl = processedUrl.replace(/^www\./, '')

  // Split by "/" and take the first part (domain only, no path)
  const domain = processedUrl.split('/')[0] || ''

  return domain?.toLowerCase() || ''
}

/**
 * Get the domain of a website URL without the protocol, www, or TLD
 * Matches backend getDomain() extension
 */
export const getDomain = (url: string): string => {
  if (!url || url.trim() === '') return ''

  let processedUrl = url.toString()
  processedUrl = processedUrl.replace(/^https?:\/\//, '')
  processedUrl = processedUrl.replace(/^www\./, '')
  processedUrl = processedUrl.replace(/\.[^.]+$/, '')
  return processedUrl?.toLowerCase() || ''
}

/**
 * Clean a website URL by adding https:// if missing, adding www. if missing, and removing trailing slash
 * Matches backend cleanWebsiteUrl() extension
 */
export const cleanWebsiteUrl = (url: string): string => {
  let cleanedUrl = url.toString().trim()

  // Add https:// if missing (always use https for consistency)
  if (!/^https?:\/\//i.test(cleanedUrl)) {
    cleanedUrl = 'https://' + cleanedUrl
  } else {
    // Convert http to https for consistency
    cleanedUrl = cleanedUrl.replace(/^http:\/\//i, 'https://')
  }

  // Add www. if missing
  const protocolMatch = cleanedUrl.match(/^(https?:\/\/)/i)
  const protocol = protocolMatch ? protocolMatch[1] : ''
  let host = cleanedUrl.slice(protocol?.length)
  if (!host.startsWith('www.')) {
    host = 'www.' + host
  }

  // Remove trailing slash
  if (host.endsWith('/')) {
    host = host.slice(0, -1)
  }

  return (protocol + host)?.toLowerCase() || ''
}

/**
 * Validate if a string is a valid URL format
 */
export const isValidUrl = (url: string): boolean => {
  if (!url || url.trim() === '') return false

  try {
    // Try to create a URL object, but first ensure it has a protocol
    let testUrl = url.trim()
    if (!/^https?:\/\//i.test(testUrl)) {
      testUrl = 'https://' + testUrl
    }

    const urlObject = new URL(testUrl)

    // Check if it has a valid hostname
    if (!urlObject.hostname || urlObject.hostname.length === 0) {
      return false
    }

    // Check if hostname contains at least one dot (for domain.tld format)
    if (!urlObject.hostname.includes('.')) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Check if a URL already exists in a list of leads (after cleaning both URLs)
 * @param url - The URL to check
 * @param leads - Array of lead objects to check against
 * @returns Object with isDuplicate boolean and existingLead if found
 */
export const checkUrlDuplicate = (
  url: string,
  leads: Array<{ id: string; url: string; name: string }>,
): { isDuplicate: boolean; existingLead?: { id: string; url: string; name: string } } => {
  if (!url.trim()) {
    return { isDuplicate: false }
  }

  try {
    const cleanedUrl = cleanWebsiteUrl(url)
    const existingLead = leads.find((lead) => {
      try {
        const cleanedLeadUrl = cleanWebsiteUrl(lead.url)
        return cleanedLeadUrl === cleanedUrl
      } catch {
        return false
      }
    })

    return {
      isDuplicate: !!existingLead,
      existingLead,
    }
  } catch {
    return { isDuplicate: false }
  }
}

/**
 * Parse and validate a list of URLs from text input
 * Supports both newline-separated and comma-separated input
 * Returns an array of objects with original input, cleaned URL, domain name, and validation status
 */
export const parseUrlList = (
  input: string,
): Array<{
  original: string
  cleaned: string
  domain: string
  fullDomain: string
  isValid: boolean
  error?: string
}> => {
  if (!input || input.trim() === '') return []

  // Split by both newlines and commas, then clean up
  const rawUrls = input
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0)

  return rawUrls.map((url) => {
    const isValid = isValidUrl(url)

    if (!isValid) {
      return {
        original: url,
        cleaned: '',
        domain: '',
        fullDomain: '',
        isValid: false,
        error: 'Invalid URL format',
      }
    }

    try {
      const cleaned = cleanWebsiteUrl(url)
      const domain = getDomain(url)
      const fullDomain = getFullDomain(url)

      if (!domain) {
        return {
          original: url,
          cleaned,
          domain: '',
          fullDomain,
          isValid: false,
          error: 'Unable to extract domain name',
        }
      }

      return {
        original: url,
        cleaned,
        domain,
        fullDomain,
        isValid: true,
      }
    } catch (error) {
      return {
        original: url,
        cleaned: '',
        domain: '',
        fullDomain: '',
        isValid: false,
        error: 'Failed to process URL',
      }
    }
  })
}
