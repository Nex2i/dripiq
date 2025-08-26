import {
  convertTextToHtml,
  isHtmlFormatted,
  formatEmailBodyForHtml,
  containsHtml,
  formatMixedContentForHtml,
} from '../emailFormatting';

describe('emailFormatting', () => {
  describe('convertTextToHtml', () => {
    it('should convert newlines to HTML breaks', () => {
      const input = 'Hi Ryan,\n\nValiente Mott handles high stakes cases.';
      const expected = 'Hi Ryan,<br><br>Valiente Mott handles high stakes cases.';
      expect(convertTextToHtml(input)).toBe(expected);
    });

    it('should handle Windows line endings', () => {
      const input = 'Line 1\r\nLine 2\r\nLine 3';
      const expected = 'Line 1<br>Line 2<br>Line 3';
      expect(convertTextToHtml(input)).toBe(expected);
    });

    it('should escape HTML special characters', () => {
      const input = 'Price: <$100 & "free" shipping\'s great>';
      const expected = 'Price: &lt;$100 &amp; &quot;free&quot; shipping&#39;s great&gt;';
      expect(convertTextToHtml(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(convertTextToHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(convertTextToHtml(null as any)).toBe('');
      expect(convertTextToHtml(undefined as any)).toBe('');
    });

    it('should convert the original email example correctly', () => {
      const input = `Hi Ryan,

Valiente Mott handles high stakes, trial ready injury cases. Depositions often make or break those files, but they also create a lot of admin work and slow down expert prep.

I work with Filevine on Depositions by Filevine. It gives same day rough drafts, AI summaries, and transcript audio and video synced directly into the case file, so your team spends less time chasing vendors and more time on strategy.

Would you be open to a brief call to see how this could fit with your intake and trial workflow?`;

      const result = convertTextToHtml(input);

      // Should contain HTML breaks
      expect(result).toContain('<br><br>');
      expect(result).toContain('Hi Ryan,<br><br>Valiente Mott');

      // Should not contain raw newlines
      expect(result).not.toContain('\n');
    });
  });

  describe('containsHtml', () => {
    it('should detect HTML tags', () => {
      expect(containsHtml('<p>Hello</p>')).toBe(true);
      expect(containsHtml('Hello <br> World')).toBe(true);
      expect(containsHtml('<div>Content</div>')).toBe(true);
      expect(containsHtml('<a href="https://example.com">Link</a>')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(containsHtml('Hello\nWorld')).toBe(false);
      expect(containsHtml('Plain text email')).toBe(false);
      expect(containsHtml('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(containsHtml(null as any)).toBe(false);
      expect(containsHtml(undefined as any)).toBe(false);
    });
  });

  describe('isHtmlFormatted', () => {
    it('should detect HTML tags', () => {
      expect(isHtmlFormatted('<p>Hello</p>')).toBe(true);
      expect(isHtmlFormatted('Hello <br> World')).toBe(true);
      expect(isHtmlFormatted('<div>Content</div>')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isHtmlFormatted('Hello\nWorld')).toBe(false);
      expect(isHtmlFormatted('Plain text email')).toBe(false);
      expect(isHtmlFormatted('')).toBe(false);
    });

    it('should handle null/undefined', () => {
      expect(isHtmlFormatted(null as any)).toBe(false);
      expect(isHtmlFormatted(undefined as any)).toBe(false);
    });
  });

  describe('formatMixedContentForHtml', () => {
    it('should convert pure plain text to HTML', () => {
      const input = 'Line 1\nLine 2';
      const expected = 'Line 1<br>Line 2';
      expect(formatMixedContentForHtml(input)).toBe(expected);
    });

    it('should preserve existing HTML content', () => {
      const input = '<p>Already <br> formatted</p>';
      expect(formatMixedContentForHtml(input)).toBe(input);
    });

    it('should handle mixed plain text and HTML', () => {
      const input = 'Hello world\n\nPlease <a href="https://example.com">click here</a>';
      const result = formatMixedContentForHtml(input);
      expect(result).toContain('Hello world<br><br>Please ');
      expect(result).toContain('<a href="https://example.com">click here</a>');
    });

    it('should handle email with calendar link', () => {
      const emailBody = 'Hi John,\n\nThanks for your interest.';
      const calendarLink = '<a href="https://tracking-url">Book a meeting</a>';
      const input = `${emailBody}\n\n${calendarLink}`;

      const result = formatMixedContentForHtml(input);
      expect(result).toContain('Hi John,<br><br>Thanks for your interest.<br><br>');
      expect(result).toContain('<a href="https://tracking-url">Book a meeting</a>');
    });

    it('should handle empty string', () => {
      expect(formatMixedContentForHtml('')).toBe('');
    });

    it('should handle content with multiple HTML elements', () => {
      const input = 'Start\n\n<a href="#">Link 1</a> and <strong>bold</strong>\n\nEnd';
      const result = formatMixedContentForHtml(input);
      expect(result).toContain('Start<br><br>');
      expect(result).toContain('<a href="#">Link 1</a>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<br><br>End');
    });
  });

  describe('formatEmailBodyForHtml', () => {
    it('should convert plain text to HTML', () => {
      const input = 'Line 1\nLine 2';
      const expected = 'Line 1<br>Line 2';
      expect(formatEmailBodyForHtml(input)).toBe(expected);
    });

    it('should leave HTML content unchanged', () => {
      const input = '<p>Already <br> formatted</p>';
      expect(formatEmailBodyForHtml(input)).toBe(input);
    });

    it('should handle mixed plain text and HTML content', () => {
      const input = 'Plain text\n\n<a href="https://example.com">Link</a>';
      const result = formatEmailBodyForHtml(input);
      expect(result).toContain('Plain text<br><br>');
      expect(result).toContain('<a href="https://example.com">Link</a>');
    });

    it('should handle empty string', () => {
      expect(formatEmailBodyForHtml('')).toBe('');
    });

    it('should handle the campaign email example', () => {
      const input = `Hi Ryan,

Valiente Mott handles high stakes, trial ready injury cases. Depositions often make or break those files, but they also create a lot of admin work and slow down expert prep.

I work with Filevine on Depositions by Filevine. It gives same day rough drafts, AI summaries, and transcript audio and video synced directly into the case file, so your team spends less time chasing vendors and more time on strategy.

Would you be open to a brief call to see how this could fit with your intake and trial workflow?`;

      const result = formatEmailBodyForHtml(input);

      // Should be properly formatted for HTML
      expect(result).toContain('Hi Ryan,<br><br>Valiente Mott');
      expect(result).toContain('admin work and slow down expert prep.<br><br>I work with Filevine');
      expect(result).toContain('time on strategy.<br><br>Would you be open');

      // Should not contain raw newlines
      expect(result).not.toContain('\n');
    });

    it('should handle email with calendar link appended', () => {
      const emailBody = `Hi John,

Thanks for your interest in our services.

Best regards,
Team`;
      const calendarLink = '<a href="https://tracking-url">Schedule a call</a>';
      const fullEmail = `${emailBody}\n\n${calendarLink}`;

      const result = formatEmailBodyForHtml(fullEmail);

      // Should convert plain text portions
      expect(result).toContain('Hi John,<br><br>Thanks for your interest');
      expect(result).toContain('Best regards,<br>Team<br><br>');

      // Should preserve HTML calendar link
      expect(result).toContain('<a href="https://tracking-url">Schedule a call</a>');

      // Should not contain raw newlines
      expect(result).not.toContain('\n');
    });
  });
});
