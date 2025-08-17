import crypto from 'crypto';
import { SendGridWebhookError } from '@/modules/webhooks/sendgrid.webhook.types';
import { SendGridWebhookValidator } from '../sendgrid.webhook.validator';

describe('SendGridWebhookValidator', () => {
  const testSecret = 'test-webhook-secret-123456789';
  const validator = new SendGridWebhookValidator(testSecret, 600);

  describe('constructor', () => {
    it('should create validator with valid secret', () => {
      expect(() => new SendGridWebhookValidator(testSecret)).not.toThrow();
    });

    it('should throw error with empty secret', () => {
      expect(() => new SendGridWebhookValidator('')).toThrow('SendGrid webhook secret is required');
    });

    it('should set default max timestamp age', () => {
      const validator = new SendGridWebhookValidator(testSecret);
      // Test that it accepts recent timestamps (indirect test)
      const currentTimestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": true}';
      const signature = generateTestSignature(currentTimestamp, payload, testSecret);

      const result = validator.verifySignature(signature, currentTimestamp, payload);
      expect(result.isValid).toBe(true);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = generateTestSignature(timestamp, payload, testSecret);

      const result = validator.verifySignature(signature, timestamp, payload);

      expect(result.isValid).toBe(true);
      expect(result.signature).toBe(signature);
      expect(result.timestamp).toBe(timestamp);
      expect(result.payload).toBe(payload);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const invalidSignature = 'invalid-signature';

      const result = validator.verifySignature(invalidSignature, timestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should reject tampered payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const originalPayload = '{"test": "data"}';
      const tamperedPayload = '{"test": "tampered"}';
      const signature = generateTestSignature(timestamp, originalPayload, testSecret);

      const result = validator.verifySignature(signature, timestamp, tamperedPayload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 700).toString(); // 700 seconds ago
      const payload = '{"test": "data"}';
      const signature = generateTestSignature(oldTimestamp, payload, testSecret);

      const result = validator.verifySignature(signature, oldTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Timestamp too old');
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString(); // 400 seconds in future
      const payload = '{"test": "data"}';
      const signature = generateTestSignature(futureTimestamp, payload, testSecret);

      const result = validator.verifySignature(signature, futureTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Timestamp too far in future');
    });

    it('should reject invalid timestamp format', () => {
      const invalidTimestamp = 'not-a-number';
      const payload = '{"test": "data"}';
      const signature = generateTestSignature('1234567890', payload, testSecret);

      const result = validator.verifySignature(signature, invalidTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should handle missing parameters', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = generateTestSignature(timestamp, payload, testSecret);

      // Missing signature
      let result = validator.verifySignature('', timestamp, payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');

      // Missing timestamp
      result = validator.verifySignature(signature, '', payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');

      // Missing payload
      result = validator.verifySignature(signature, timestamp, '');
      expect(result.isValid).toBe(false); // Empty string is valid payload
    });

    it('should handle undefined payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = 'test-signature';

      const result = validator.verifySignature(signature, timestamp, undefined as any);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');
    });
  });

  describe('verifyWebhookRequest', () => {
    it('should verify valid webhook request', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '[{"event": "delivered", "email": "test@example.com"}]';
      const signature = generateTestSignature(timestamp, payload, testSecret);

      const headers = {
        'x-twilio-email-event-webhook-signature': signature,
        'x-twilio-email-event-webhook-timestamp': timestamp,
        'content-type': 'application/json' as const,
        'user-agent': 'SendGrid Event Webhook',
      };

      const result = validator.verifyWebhookRequest(headers, payload);

      expect(result.isValid).toBe(true);
    });

    it('should reject request with missing headers', () => {
      const payload = '[{"event": "delivered"}]';
      const headers = {
        'content-type': 'application/json' as const,
      };

      const result = validator.verifyWebhookRequest(headers, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing SendGrid signature or timestamp headers');
    });

    it('should handle partial headers', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '[]';

      // Missing signature
      let headers = {
        'x-twilio-email-event-webhook-timestamp': timestamp,
      };
      let result = validator.verifyWebhookRequest(headers, payload);
      expect(result.isValid).toBe(false);

      // Missing timestamp
      headers = {
        'x-twilio-email-event-webhook-signature': 'test-signature',
      } as any;
      result = validator.verifyWebhookRequest(headers, payload);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        webhookSecret: 'valid-secret-123456789',
        maxTimestampAge: 300,
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).not.toThrow();
    });

    it('should reject missing webhook secret', () => {
      const config = {
        maxTimestampAge: 300,
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(SendGridWebhookError);
      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(
        'SendGrid webhook secret is required'
      );
    });

    it('should reject weak webhook secret', () => {
      const config = {
        webhookSecret: 'short', // Less than 16 characters
        maxTimestampAge: 300,
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(SendGridWebhookError);
      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(
        'SendGrid webhook secret must be at least 16 characters'
      );
    });

    it('should reject invalid max timestamp age', () => {
      const config = {
        webhookSecret: 'valid-secret-123456789',
        maxTimestampAge: 30, // Too low
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(SendGridWebhookError);
      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(
        'Max timestamp age must be between 60 and 3600 seconds'
      );

      config.maxTimestampAge = 4000; // Too high
      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(SendGridWebhookError);
    });
  });

  describe('fromEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should create validator from environment variables', () => {
      process.env.SENDGRID_WEBHOOK_SECRET = 'test-secret-from-env-123';
      process.env.SENDGRID_WEBHOOK_MAX_AGE = '300';

      expect(() => SendGridWebhookValidator.fromEnvironment()).not.toThrow();
    });

    it('should use default max age when not specified', () => {
      process.env.SENDGRID_WEBHOOK_SECRET = 'test-secret-from-env-123';
      delete process.env.SENDGRID_WEBHOOK_MAX_AGE;

      const validator = SendGridWebhookValidator.fromEnvironment();
      expect(validator).toBeDefined();
    });

    it('should throw when secret is missing from environment', () => {
      delete process.env.SENDGRID_WEBHOOK_SECRET;

      expect(() => SendGridWebhookValidator.fromEnvironment()).toThrow(SendGridWebhookError);
    });
  });

  describe('constant time comparison', () => {
    it('should handle strings of different lengths', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const shortSignature = 'short';

      const result = validator.verifySignature(shortSignature, timestamp, payload);

      expect(result.isValid).toBe(false);
    });

    it('should handle empty signatures', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';

      const result = validator.verifySignature('', timestamp, payload);

      expect(result.isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle very large payloads', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const largePayload = JSON.stringify({ data: 'x'.repeat(10000) });
      const signature = generateTestSignature(timestamp, largePayload, testSecret);

      const result = validator.verifySignature(signature, timestamp, largePayload);

      expect(result.isValid).toBe(true);
    });

    it('should handle special characters in payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const specialPayload = '{"text": "Hello 世界! 🌍 Special chars: àáâãäåæçèéêë"}';
      const signature = generateTestSignature(timestamp, specialPayload, testSecret);

      const result = validator.verifySignature(signature, timestamp, specialPayload);

      expect(result.isValid).toBe(true);
    });

    it('should handle JSON with whitespace variations', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload1 = '{"test":"data"}';
      const payload2 = '{ "test" : "data" }';

      const signature1 = generateTestSignature(timestamp, payload1, testSecret);
      const signature2 = generateTestSignature(timestamp, payload2, testSecret);

      // Same signature should not work for different payloads (even with just whitespace differences)
      const result1 = validator.verifySignature(signature1, timestamp, payload2);
      const result2 = validator.verifySignature(signature2, timestamp, payload1);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });
  });
});

// Helper function to generate test signatures
function generateTestSignature(timestamp: string, payload: string, secret: string): string {
  const signedPayload = timestamp + payload;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload, 'utf8');
  return hmac.digest('base64');
}
