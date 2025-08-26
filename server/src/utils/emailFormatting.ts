/**
 * Utility functions for email formatting
 */

/**
 * Converts HTML content to plain text by removing HTML tags and entities.
 * Preserves line breaks and basic text formatting for readability.
 *
 * @param html - HTML content to convert
 * @returns Plain text version
 */
export function convertHtmlToText(html: string): string {
  if (!html) {
    return '';
  }

  let text = html;

  // Convert common HTML elements to plain text equivalents
  text = text
    // Convert line breaks and paragraphs to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    // Convert headers to plain text with spacing
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<h[1-6][^>]*>/gi, '')
    // Convert lists
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<(ul|ol)[^>]*>/gi, '')
    // Convert divs to line breaks
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    // Remove all other HTML tags
    .replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up extra whitespace and newlines
  text = text
    // Replace multiple consecutive spaces with single space
    .replace(/[ \t]+/g, ' ')
    // Replace multiple consecutive newlines with double newline
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim whitespace from each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    // Trim overall string
    .trim();

  return text;
}

/**
 * Converts plain text to HTML-formatted text for email display.
 * This preserves line breaks and paragraphs while keeping the text safe for HTML.
 *
 * @param text - Plain text with newlines
 * @returns HTML-formatted text with proper line breaks
 */
export function convertTextToHtml(text: string): string {
  if (!text) {
    return '';
  }

  // Escape HTML special characters first
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Convert newlines to HTML breaks
  // Handle both Windows (\r\n) and Unix (\n) line endings
  return escapedText.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
}

/**
 * Checks if a string contains HTML tags
 *
 * @param text - Text to check
 * @returns true if the text appears to contain HTML tags
 */
export function containsHtml(text: string): boolean {
  if (!text) {
    return false;
  }

  // Simple check for common HTML tags
  const htmlTagPattern = /<[^>]+>/;
  return htmlTagPattern.test(text);
}

/**
 * Formats mixed content for HTML email delivery.
 * Handles content that may contain both plain text and HTML elements.
 * Preserves existing HTML while converting plain text portions to HTML.
 *
 * @param content - Content that may contain mixed plain text and HTML
 * @returns HTML-formatted content
 */
export function formatMixedContentForHtml(content: string): string {
  if (!content) {
    return '';
  }

  // If the content contains HTML, we need to handle it carefully
  if (containsHtml(content)) {
    // Split content by HTML tags to separate plain text from HTML
    const parts = content.split(/(<[^>]+>)/);

    return parts
      .map((part) => {
        // If this part is an HTML tag, preserve it as-is
        if (part.match(/^<[^>]+>$/)) {
          return part;
        }
        // If this part is between HTML tags or contains HTML-like content,
        // we need to be more careful
        if (containsHtml(part)) {
          return part; // Preserve existing HTML
        }
        // This is plain text, convert newlines to <br> but don't double-escape
        // if it's already been processed
        return part.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
      })
      .join('');
  }

  // Pure plain text - convert to HTML
  return convertTextToHtml(content);
}

/**
 * Formats email body text for HTML email delivery.
 * Supports mixed content (plain text with HTML elements).
 *
 * @param bodyText - Email body text (plain text, HTML, or mixed)
 * @returns HTML-formatted email body
 */
export function formatEmailBodyForHtml(bodyText: string): string {
  if (!bodyText) {
    return '';
  }

  return formatMixedContentForHtml(bodyText);
}

/**
 * Formats email body text for plain text email delivery.
 * If the content contains HTML, it will be converted to plain text.
 * If it's already plain text, it will be returned as-is.
 *
 * @param bodyText - Email body text (plain text, HTML, or mixed)
 * @returns Plain text email body
 */
export function formatEmailBodyForText(bodyText: string): string {
  if (!bodyText) {
    return '';
  }

  // If the content contains HTML, convert it to plain text
  if (containsHtml(bodyText)) {
    return convertHtmlToText(bodyText);
  }

  // Already plain text, return as-is
  return bodyText;
}
