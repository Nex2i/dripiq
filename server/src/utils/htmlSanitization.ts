import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuration for email signature HTML sanitization
 * Allows basic formatting tags while preventing XSS attacks
 */
const EMAIL_SIGNATURE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'div',
    'span',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'a',
    'img',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'table',
    'tr',
    'td',
    'th',
    'tbody',
    'thead',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'alt',
    'src',
    'width',
    'height',
    'style',
    'class',
    'id',
    'target',
    'rel',
  ],
  // Only allow safe URLs for links and images
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
  // Prevent data: URLs and javascript: URLs
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
};

/**
 * Sanitizes HTML content for email signatures
 * Removes potentially dangerous tags and attributes while preserving basic formatting
 *
 * @param html - Raw HTML content from user input
 * @returns Sanitized HTML safe for email inclusion
 */
export function sanitizeEmailSignatureHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Trim whitespace
  const trimmed = html.trim();
  if (!trimmed) {
    return '';
  }

  try {
    // Sanitize the HTML using DOMPurify with email signature config
    const sanitized = DOMPurify.sanitize(trimmed, EMAIL_SIGNATURE_CONFIG);

    // Additional custom sanitization
    let result = sanitized;

    // Remove any remaining script-like content
    result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
    result = result.replace(/javascript:/gi, '');
    result = result.replace(/on\w+\s*=/gi, '');

    // Ensure external links open in new tab and have safe rel attributes
    result = result.replace(/<a\s+([^>]*href\s*=\s*["'][^"']*["'][^>]*)>/gi, (_match, attrs) => {
      if (!attrs.includes('target=')) {
        attrs += ' target="_blank"';
      }
      if (!attrs.includes('rel=')) {
        attrs += ' rel="noopener noreferrer"';
      }
      return `<a ${attrs}>`;
    });

    return result;
  } catch (_error) {
    // If sanitization fails, return empty string for safety
    console.error('HTML sanitization failed:', _error);
    return '';
  }
}

/**
 * Validates email signature content
 * Checks length limits and ensures content is safe
 *
 * @param signature - Email signature content (plain text or HTML)
 * @param maxLength - Maximum allowed length (default: 5000 characters)
 * @returns Validation result with sanitized content or error
 */
export function validateEmailSignature(
  signature: string | null | undefined,
  maxLength: number = 5000
): { isValid: boolean; sanitized?: string; error?: string } {
  // Allow null/undefined (no signature)
  if (signature === null || signature === undefined) {
    return { isValid: true, sanitized: null };
  }

  // Must be a string
  if (typeof signature !== 'string') {
    return { isValid: false, error: 'Signature must be a string' };
  }

  // Check length limit
  if (signature.length > maxLength) {
    return {
      isValid: false,
      error: `Signature exceeds maximum length of ${maxLength} characters`,
    };
  }

  // Empty signature is valid
  const trimmed = signature.trim();
  if (!trimmed) {
    return { isValid: true, sanitized: '' };
  }

  try {
    // Check if content appears to be HTML
    const hasHtmlTags = /<[^>]+>/.test(trimmed);

    if (hasHtmlTags) {
      // Sanitize HTML content
      const sanitized = sanitizeEmailSignatureHtml(trimmed);

      // Check if sanitization removed too much content (possible malicious input)
      const originalLength = trimmed.length;
      const sanitizedLength = sanitized.length;
      const reductionRatio = (originalLength - sanitizedLength) / originalLength;

      if (reductionRatio > 0.8) {
        return {
          isValid: false,
          error: 'Signature contains too much unsafe content and cannot be processed',
        };
      }

      return { isValid: true, sanitized };
    } else {
      // Plain text content - just return trimmed
      return { isValid: true, sanitized: trimmed };
    }
  } catch (_error) {
    return {
      isValid: false,
      error: 'Failed to validate signature content',
    };
  }
}

/**
 * Simple HTML detection utility
 * @param text - Text to check
 * @returns true if text contains HTML tags
 */
export function containsHtmlTags(text: string): boolean {
  return /<[^>]+>/.test(text);
}
