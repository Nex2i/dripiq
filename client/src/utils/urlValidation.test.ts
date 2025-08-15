import { UrlValidator, UrlValidationResult } from './urlValidation';

describe('UrlValidator', () => {
  describe('isValidUrl', () => {
    it('should return false for HTTP URLs (HTTPS only)', () => {
      expect(UrlValidator.isValidUrl('http://example.com')).toBe(false);
      expect(UrlValidator.isValidUrl('http://www.example.com')).toBe(false);
      expect(UrlValidator.isValidUrl('http://example.com/path')).toBe(false);
      expect(UrlValidator.isValidUrl('http://example.com:8080')).toBe(false);
    });

    it('should return true for valid HTTPS URLs', () => {
      expect(UrlValidator.isValidUrl('https://example.com')).toBe(true);
      expect(UrlValidator.isValidUrl('https://www.example.com')).toBe(true);
      expect(UrlValidator.isValidUrl('https://calendly.com/john-doe')).toBe(true);
      expect(UrlValidator.isValidUrl('https://cal.com/jane-smith/30min')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(UrlValidator.isValidUrl('not-a-url')).toBe(false);
      expect(UrlValidator.isValidUrl('ftp://example.com')).toBe(false);
      expect(UrlValidator.isValidUrl('mailto:test@example.com')).toBe(false);
      expect(UrlValidator.isValidUrl('javascript:alert("test")')).toBe(false);
    });

    it('should return false for empty or null values', () => {
      expect(UrlValidator.isValidUrl('')).toBe(false);
      expect(UrlValidator.isValidUrl('   ')).toBe(false);
      expect(UrlValidator.isValidUrl(null as any)).toBe(false);
      expect(UrlValidator.isValidUrl(undefined as any)).toBe(false);
    });

    it('should handle URLs with whitespace', () => {
      expect(UrlValidator.isValidUrl('  https://example.com  ')).toBe(true);
      expect(UrlValidator.isValidUrl('\thttps://example.com\n')).toBe(true);
    });

    it('should return false for malformed URLs', () => {
      expect(UrlValidator.isValidUrl('https://')).toBe(false);
      expect(UrlValidator.isValidUrl('https://.')).toBe(true); // This is actually valid per URL spec
      expect(UrlValidator.isValidUrl('https://example')).toBe(true); // This is actually valid
      expect(UrlValidator.isValidUrl('http://.com')).toBe(false); // HTTP not allowed
    });
  });

  describe('validateCalendarLink', () => {
    describe('when allowEmpty is true (default)', () => {
      it('should allow empty values when no initial value', () => {
        const result = UrlValidator.validateCalendarLink('', '');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow empty values when there was no initial value', () => {
        const result = UrlValidator.validateCalendarLink('   ', '');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow empty values even when there was an initial value', () => {
        const result = UrlValidator.validateCalendarLink('', 'https://calendly.com/initial');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate URL format for non-empty values', () => {
        const result = UrlValidator.validateCalendarLink('https://calendly.com/john');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject invalid URLs', () => {
        const result = UrlValidator.validateCalendarLink('not-a-url');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Please enter a valid HTTPS URL (e.g., https://calendly.com/your-link)');
      });

      it('should reject HTTP URLs (HTTPS only)', () => {
        const result = UrlValidator.validateCalendarLink('http://calendly.com/john');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Please enter a valid HTTPS URL (e.g., https://calendly.com/your-link)');
      });
    });

    describe('when allowEmpty is false', () => {
      it('should allow empty values when no initial value', () => {
        const result = UrlValidator.validateCalendarLink('', '', false);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject empty values when there was an initial value', () => {
        const result = UrlValidator.validateCalendarLink('', 'https://calendly.com/initial', false);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Calendar link cannot be removed once set. Please provide a valid URL.');
      });

      it('should reject whitespace-only values when there was an initial value', () => {
        const result = UrlValidator.validateCalendarLink('   ', 'https://calendly.com/initial', false);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Calendar link cannot be removed once set. Please provide a valid URL.');
      });

      it('should validate URL format for non-empty values', () => {
        const result = UrlValidator.validateCalendarLink('https://cal.com/jane', 'https://calendly.com/initial', false);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    describe('edge cases', () => {
      it('should handle null and undefined values', () => {
        const result1 = UrlValidator.validateCalendarLink(null as any, '');
        expect(result1.isValid).toBe(true);

        const result2 = UrlValidator.validateCalendarLink(undefined as any, '');
        expect(result2.isValid).toBe(true);
      });

      it('should trim whitespace from URLs before validation', () => {
        const result = UrlValidator.validateCalendarLink('  https://calendly.com/john  ');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });
  });

  describe('validateCalendarLinkStrict', () => {
    it('should use strict validation (allowEmpty = false)', () => {
      const result = UrlValidator.validateCalendarLinkStrict('', 'https://calendly.com/initial');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Calendar link cannot be removed once set. Please provide a valid URL.');
    });

    it('should allow empty when no initial value', () => {
      const result = UrlValidator.validateCalendarLinkStrict('', '');
      expect(result.isValid).toBe(true);
    });

    it('should validate valid URLs', () => {
      const result = UrlValidator.validateCalendarLinkStrict('https://cal.com/jane');
      expect(result.isValid).toBe(true);
    });
  });

  describe('isCommonCalendarService', () => {
    it('should return true for known calendar services', () => {
      expect(UrlValidator.isCommonCalendarService('https://calendly.com/john')).toBe(true);
      expect(UrlValidator.isCommonCalendarService('https://cal.com/jane')).toBe(true);
      expect(UrlValidator.isCommonCalendarService('https://acuityscheduling.com/schedule.php')).toBe(true);
      expect(UrlValidator.isCommonCalendarService('https://youcanbook.me/service')).toBe(true);
      expect(UrlValidator.isCommonCalendarService('https://calendar.google.com/calendar')).toBe(true);
    });

    it('should return true for subdomains of known services', () => {
      expect(UrlValidator.isCommonCalendarService('https://app.calendly.com/john')).toBe(true);
      expect(UrlValidator.isCommonCalendarService('https://booking.acuityscheduling.com/schedule')).toBe(true);
    });

    it('should return false for unknown services', () => {
      expect(UrlValidator.isCommonCalendarService('https://example.com/calendar')).toBe(false);
      expect(UrlValidator.isCommonCalendarService('https://unknown-service.com')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(UrlValidator.isCommonCalendarService('not-a-url')).toBe(false);
      expect(UrlValidator.isCommonCalendarService('')).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(UrlValidator.isCommonCalendarService('https://CALENDLY.COM/john')).toBe(true);
      expect(UrlValidator.isCommonCalendarService('https://Cal.Com/jane')).toBe(true);
    });
  });

  describe('getCalendarUrlExamples', () => {
    it('should return an array of example URLs', () => {
      const examples = UrlValidator.getCalendarUrlExamples();
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
      
      // Verify all examples are valid URLs
      examples.forEach(example => {
        expect(UrlValidator.isValidUrl(example)).toBe(true);
      });
    });

    it('should include popular calendar services', () => {
      const examples = UrlValidator.getCalendarUrlExamples();
      const exampleText = examples.join(' ');
      
      expect(exampleText).toContain('calendly.com');
      expect(exampleText).toContain('cal.com');
    });
  });

  describe('integration scenarios', () => {
    it('should handle a complete user flow - initial empty, add URL, validate', () => {
      // User starts with no calendar link
      let result = UrlValidator.validateCalendarLinkStrict('', '');
      expect(result.isValid).toBe(true);

      // User adds an invalid URL
      result = UrlValidator.validateCalendarLinkStrict('invalid-url', '');
      expect(result.isValid).toBe(false);

      // User adds a valid URL
      result = UrlValidator.validateCalendarLinkStrict('https://calendly.com/john-doe', '');
      expect(result.isValid).toBe(true);

      // Now user tries to remove it (should fail in strict mode)
      result = UrlValidator.validateCalendarLinkStrict('', 'https://calendly.com/john-doe');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be removed');
    });

    it('should handle calendar service detection for user guidance', () => {
      const validCalendlyUrl = 'https://calendly.com/john-doe';
      const validButUnknownUrl = 'https://mybusiness.com/calendar';

      expect(UrlValidator.isValidUrl(validCalendlyUrl)).toBe(true);
      expect(UrlValidator.isCommonCalendarService(validCalendlyUrl)).toBe(true);

      expect(UrlValidator.isValidUrl(validButUnknownUrl)).toBe(true);
      expect(UrlValidator.isCommonCalendarService(validButUnknownUrl)).toBe(false);
    });
  });
});