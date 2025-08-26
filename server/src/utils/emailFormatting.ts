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
 * Checks if a string is already HTML formatted
 *
 * @param text - Text to check
 * @returns true if the text appears to contain HTML tags
 */
export function isHtmlFormatted(text: string): boolean {
  if (!text) {
    return false;
  }

  // Simple check for common HTML tags
  const htmlTagPattern = /<[^>]+>/;
  return htmlTagPattern.test(text);
}

/**
 * Formats email body text for HTML email delivery.
 * If the text is already HTML, returns as-is.
 * If it's plain text, converts newlines to HTML breaks.
 *
 * @param bodyText - Email body text (plain text or HTML)
 * @returns HTML-formatted email body
 */
export function formatEmailBodyForHtml(bodyText: string): string {
  if (!bodyText) {
    return '';
  }

  // If it's already HTML-formatted, return as-is
  if (isHtmlFormatted(bodyText)) {
    return bodyText;
  }

  // Convert plain text to HTML
  return convertTextToHtml(bodyText);
}
