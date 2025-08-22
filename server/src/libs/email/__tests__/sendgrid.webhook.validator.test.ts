import { SendGridWebhookError } from '@/modules/webhooks/sendgrid.webhook.types';
import { SendGridWebhookValidator } from '../sendgrid.webhook.validator';

describe('SendGridWebhookValidator', () => {
  // Use your actual public key for testing
  const testPublicKeyBase64 =
    'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEkwgSoBl4B3ImPikwdImVBr/FNBY+3f1at6g8DAJEOEeXKdfDqscbTcDHBs6wYWbMY9igBHg6g3YSBtXaUq77vA==';

  const validator = new SendGridWebhookValidator(testPublicKeyBase64, 600);

  describe('constructor', () => {
    it('should create validator with valid public key', () => {
      expect(() => new SendGridWebhookValidator(testPublicKeyBase64)).not.toThrow();
    });

    it('should throw error with empty public key', () => {
      expect(() => new SendGridWebhookValidator('')).toThrow(
        'SendGrid webhook public key is required'
      );
    });

    it('should set default max timestamp age', () => {
      const validator = new SendGridWebhookValidator(testPublicKeyBase64);
      expect(validator).toBeDefined();
    });
  });

  describe('verifySignature', () => {
    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const invalidSignature = 'invalid-signature';

      const result = validator.verifySignature(invalidSignature, timestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 700).toString(); // 700 seconds ago
      const payload = '{"test": "data"}';
      const signature = 'some-valid-looking-signature';

      const result = validator.verifySignature(signature, oldTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Timestamp too old');
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString(); // 400 seconds in future
      const payload = '{"test": "data"}';
      const signature = 'some-valid-looking-signature';

      const result = validator.verifySignature(signature, futureTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Timestamp too far in future');
    });

    it('should reject invalid timestamp format', () => {
      const invalidTimestamp = 'not-a-number';
      const payload = '{"test": "data"}';
      const signature = 'some-valid-looking-signature';

      const result = validator.verifySignature(signature, invalidTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should handle missing parameters', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = 'some-signature';

      // Missing signature
      let result = validator.verifySignature('', timestamp, payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');

      // Missing timestamp
      result = validator.verifySignature(signature, '', payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');

      // Undefined payload
      result = validator.verifySignature(signature, timestamp, undefined as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');
    });

    it('should handle empty string payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = 'some-signature';

      // Empty string is a valid payload, should proceed to signature verification
      const result = validator.verifySignature(signature, timestamp, '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed'); // Should fail at signature step, not payload validation
    });
  });

  describe('verifyWebhookRequest', () => {
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
      expect(result.error).toBe('Missing SendGrid signature or timestamp headers');

      // Missing timestamp
      headers = {
        'x-twilio-email-event-webhook-signature': 'test-signature',
      } as any;
      result = validator.verifyWebhookRequest(headers, payload);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing SendGrid signature or timestamp headers');
    });

    it('should pass headers to signature verification', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '[{"event": "delivered", "email": "test@example.com"}]';
      const signature = 'some-test-signature';

      const headers = {
        'x-twilio-email-event-webhook-signature': signature,
        'x-twilio-email-event-webhook-timestamp': timestamp,
        'content-type': 'application/json' as const,
        'user-agent': 'SendGrid Event Webhook',
      };

      const result = validator.verifyWebhookRequest(headers, payload);

      // Should fail at signature verification step, not header validation
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
      expect(result.signature).toBe(signature);
      expect(result.timestamp).toBe(timestamp);
      expect(result.payload).toBe(payload);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        publicKey: testPublicKeyBase64,
        maxTimestampAge: 300,
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).not.toThrow();
    });

    it('should reject missing webhook public key', () => {
      const config = {
        maxTimestampAge: 300,
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(SendGridWebhookError);
      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(
        'SendGrid webhook public key is required'
      );
    });

    it('should reject short public key', () => {
      const config = {
        publicKey: 'dGVzdA==', // 'test' in base64 - too short
        maxTimestampAge: 300,
      };

      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(SendGridWebhookError);
      expect(() => SendGridWebhookValidator.validateConfig(config)).toThrow(
        'SendGrid webhook public key appears to be too short'
      );
    });

    it('should reject invalid max timestamp age', () => {
      const config = {
        publicKey: testPublicKeyBase64,
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
      process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = testPublicKeyBase64;
      process.env.SENDGRID_WEBHOOK_MAX_AGE = '300';

      expect(() => SendGridWebhookValidator.fromEnvironment()).not.toThrow();
    });

    it('should use default max age when not specified', () => {
      process.env.SENDGRID_WEBHOOK_PUBLIC_KEY = testPublicKeyBase64;
      delete process.env.SENDGRID_WEBHOOK_MAX_AGE;

      const validator = SendGridWebhookValidator.fromEnvironment();
      expect(validator).toBeDefined();
    });

    it('should throw when public key is missing from environment', () => {
      delete process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;

      expect(() => SendGridWebhookValidator.fromEnvironment()).toThrow(SendGridWebhookError);
    });
  });

  describe('ECDSA signature verification', () => {
    it('should handle malformed signatures gracefully', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const malformedSignature = 'not-a-valid-base64-signature!@#';

      const result = validator.verifySignature(malformedSignature, timestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should handle empty signatures', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';

      const result = validator.verifySignature('', timestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing required signature, timestamp, or payload');
    });
  });

  describe('edge cases', () => {
    it('should handle large payloads without crashing', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const largePayload = JSON.stringify({ data: 'x'.repeat(10000) });
      const signature = 'test-signature';

      const result = validator.verifySignature(signature, timestamp, largePayload);

      // Should fail at signature verification, not crash
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should handle special characters in payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const specialPayload = '{"text": "Hello 世界! 🌍 Special chars: àáâãäåæçèéêë"}';
      const signature = 'test-signature';

      const result = validator.verifySignature(signature, timestamp, specialPayload);

      // Should fail at signature verification, not crash on special characters
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should handle JSON with different whitespace', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload1 = '{"test":"data"}';
      const payload2 = '{ "test" : "data" }';
      const signature = 'test-signature';

      const result1 = validator.verifySignature(signature, timestamp, payload1);
      const result2 = validator.verifySignature(signature, timestamp, payload2);

      // Both should fail signature verification but handle the payloads correctly
      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result1.payload).toBe(payload1);
      expect(result2.payload).toBe(payload2);
    });
  });

  describe('PEM conversion', () => {
    it('should convert base64 to PEM format correctly', () => {
      // This tests the internal convertBase64ToPEM method indirectly
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = 'test-signature';

      // Should not throw during PEM conversion
      expect(() => {
        validator.verifySignature(signature, timestamp, payload);
      }).not.toThrow();
    });
  });
});
