import '@/extensions';
import { EmailValidationService } from '../emailValidation.service';

/**
 * Integration tests for EmailValidationService
 * These tests use real DNS lookups and are slower but test actual functionality
 */
describe('EmailValidationService Integration Tests', () => {
  let service: EmailValidationService;

  beforeEach(() => {
    service = EmailValidationService.createDefault();
  });

  describe('Real world email validation', () => {
    it('should validate a Gmail address', async () => {
      const result = await service.validateEmail('test@gmail.com');

      expect(result.email).toBe('test@gmail.com');
      expect(result.status).toBe('valid');
      expect(result.account).toBe('test');
      expect(result.domain).toBe('gmail.com');
      expect(result.free_email).toBe(true);
      expect(result.smtp_provider).toBe('google');
      expect(result.mx_found).toBe(true);
      expect(result.mx_record).toMatch(/gmail/i);
    }, 10000); // 10 second timeout for network calls

    it('should validate an Outlook address', async () => {
      const result = await service.validateEmail('user@outlook.com');

      expect(result.email).toBe('user@outlook.com');
      expect(result.status).toBe('valid');
      expect(result.domain).toBe('outlook.com');
      expect(result.free_email).toBe(true);
      expect(result.smtp_provider).toBe('microsoft');
      expect(result.mx_found).toBe(true);
    }, 10000);

    it('should identify role-based email', async () => {
      const result = await service.validateEmail('admin@gmail.com');

      expect(result.status).toBe('valid');
      expect(result.sub_status).toBe('role_based');
      expect(result.firstname).toBe(null);
      expect(result.lastname).toBe(null);
    }, 10000);

    it('should extract names from email patterns', async () => {
      const result = await service.validateEmail('john.doe@gmail.com');

      expect(result.firstname).toBe('John');
      expect(result.lastname).toBe('Doe');
    }, 10000);

    it('should handle domain with no MX records', async () => {
      const result = await service.validateEmail('user@nonexistentdomain12345.com');

      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('no_mx_record');
      expect(result.mx_found).toBe(false);
    }, 10000);

    it('should suggest corrections for typos', async () => {
      const result = await service.validateEmail('user@gmai.com');

      expect(result.did_you_mean).toBe('user@gmail.com');
    }, 10000);

    it('should identify disposable email', async () => {
      const result = await service.validateEmail('test@10minutemail.com');

      // Note: This test might fail if the domain actually exists
      // In a production system, you'd have a more comprehensive disposable domain list
      expect(result.status).toBe('invalid');
      expect(result.sub_status).toBe('disposable');
    }, 10000);
  });

  describe('Performance tests', () => {
    it('should validate multiple emails efficiently', async () => {
      const emails = [
        'test1@gmail.com',
        'test2@yahoo.com',
        'test3@outlook.com',
        'invalid@nonexistent12345.com',
      ];

      const startTime = Date.now();

      const results = await Promise.all(emails.map((email) => service.validateEmail(email)));

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(4);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      // Check that valid emails are identified correctly
      expect(results[0]?.status).toBe('valid'); // Gmail
      expect(results[1]?.status).toBe('valid'); // Yahoo
      expect(results[2]?.status).toBe('valid'); // Outlook
      expect(results[3]?.status).toBe('invalid'); // Nonexistent
    }, 20000);
  });

  describe('Error handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // Create service with very short timeout to force timeout
      const quickTimeoutService = new EmailValidationService({
        enableSmtpValidation: true,
        smtpTimeout: 1, // 1ms timeout
        maxRetries: 1,
      });

      const result = await quickTimeoutService.validateEmail('test@gmail.com');

      // Should still return a result, even if SMTP validation fails
      expect(result.email).toBe('test@gmail.com');
      expect(['valid', 'unknown']).toContain(result.status);
    }, 10000);

    it('should handle malformed emails gracefully', async () => {
      const malformedEmails = [
        '',
        '   ',
        'not-an-email',
        '@domain.com',
        'user@',
        'user@@domain.com',
        'user@domain',
        'user name@domain.com',
      ];

      for (const email of malformedEmails) {
        const result = await service.validateEmail(email);
        expect(result.status).toBe('invalid');
        expect(['invalid_syntax', 'invalid_format']).toContain(result.sub_status);
      }
    });
  });

  describe('Factory methods', () => {
    it('should create default service instance', () => {
      const defaultService = EmailValidationService.createDefault();
      expect(defaultService).toBeInstanceOf(EmailValidationService);
    });

    it('should create SMTP-enabled service instance', () => {
      const smtpService = EmailValidationService.createWithSmtpValidation();
      expect(smtpService).toBeInstanceOf(EmailValidationService);
    });
  });
});
