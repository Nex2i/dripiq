export interface UrlValidationResult {
  isValid: boolean
  error?: string
}

export class UrlValidator {
  /**
   * Validates if a string is a valid HTTPS URL
   */
  static isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false
    }

    try {
      const urlObj = new URL(url.trim())
      // Only allow HTTPS protocol
      return urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  /**
   * Validates a calendar link with specific business rules
   * @param currentValue - The current calendar link value
   * @param initialValue - The initial value (empty string if no initial value)
   * @param allowEmpty - Whether empty values are allowed (default: true)
   */
  static validateCalendarLink(
    currentValue: string,
    initialValue: string = '',
    allowEmpty: boolean = true,
  ): UrlValidationResult {
    const trimmedCurrent = currentValue?.trim() || ''
    const trimmedInitial = initialValue?.trim() || ''

    // Check if empty
    if (!trimmedCurrent) {
      // If there was an initial value and we don't allow empty, reject
      if (trimmedInitial && !allowEmpty) {
        return {
          isValid: false,
          error:
            'Calendar link cannot be removed once set. Please provide a valid URL.',
        }
      }
      // Empty is okay if no initial value or empty is allowed
      return { isValid: true }
    }

    // Validate URL format
    if (!this.isValidUrl(trimmedCurrent)) {
      return {
        isValid: false,
        error:
          'Please enter a valid HTTPS URL (e.g., https://calendly.com/your-link)',
      }
    }

    return { isValid: true }
  }

  /**
   * Validates a calendar link with the business rule that once set, it cannot be empty
   */
  static validateCalendarLinkStrict(
    currentValue: string,
    initialValue: string = '',
  ): UrlValidationResult {
    return this.validateCalendarLink(currentValue, initialValue, false)
  }

  /**
   * Gets common calendar URL patterns for validation hints
   */
  static getCalendarUrlExamples(): string[] {
    return [
      'https://calendly.com/your-name',
      'https://cal.com/your-name',
      'https://acuityscheduling.com/schedule.php?owner=12345',
      'https://outlook.live.com/calendar/published/your-calendar-id',
    ]
  }

  /**
   * Checks if URL matches common calendar service patterns
   */
  static isCommonCalendarService(url: string): boolean {
    if (!this.isValidUrl(url)) {
      return false
    }

    const calendarDomains = [
      'calendly.com',
      'cal.com',
      'acuityscheduling.com',
      'schedulonce.com',
      'youcanbook.me',
      'setmore.com',
      'simplybook.me',
      'square.com',
      'outlook.live.com',
      'calendar.google.com',
    ]

    try {
      const urlObj = new URL(url.trim())
      const hostname = urlObj.hostname.toLowerCase()

      return calendarDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      )
    } catch {
      return false
    }
  }
}
