/**
 * Utility functions for email formatting
 */

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
 * Checks if a string is already HTML formatted (legacy function for backward compatibility)
 *
 * @param text - Text to check
 * @returns true if the text appears to contain HTML tags
 */
export function isHtmlFormatted(text: string): boolean {
  return containsHtml(text);
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
 * If the text is already HTML, returns as-is.
 * If it's plain text, converts newlines to HTML breaks.
 * Now supports mixed content (plain text with HTML elements).
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
