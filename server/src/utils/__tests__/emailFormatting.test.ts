import { convertTextToHtml, isHtmlFormatted, formatEmailBodyForHtml } from '../emailFormatting';

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
  });
});
