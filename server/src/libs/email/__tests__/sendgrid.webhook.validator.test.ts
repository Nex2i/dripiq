import crypto from 'crypto';
import { SendGridWebhookError } from '@/modules/webhooks/sendgrid.webhook.types';
import { SendGridWebhookValidator } from '../sendgrid.webhook.validator';

describe('SendGridWebhookValidator', () => {
  // Pre-generated ECDSA key pair for testing (P-256 curve)
  const testPrivateKeyPem = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgQx8kE7HQ6QdGK4kp
bUFOUdqrXMhGYYYmCR9+4fLwVoOhRANCAASSCBKgGXgHciY+KTB0iZUGv8U0Fj7d
/Vq3qDwMAkQ4R5cp18OqxxtNwMcGzrBhZsxj2KAEeDqDdhIG1dpSrvu8
-----END PRIVATE KEY-----`;

  const testPublicKeyPem = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEkggSoBl4B3ImPikwdImVBr/FNBY+
3f1at6g8DAJEOEeXKdfDqscbTcDHBs6wYWbMY9igBHg6g3YSBtXaUq77vA==
-----END PUBLIC KEY-----`;

  // Convert the public key PEM to base64 format (without headers/footers)
  const testPublicKeyBase64 = testPublicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s/g, '');

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
      // Test that it accepts recent timestamps (indirect test)
      const currentTimestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": true}';
      const signature = generateTestECDSASignature(currentTimestamp, payload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, currentTimestamp, payload);
      expect(result.isValid).toBe(true);
    });
  });

  describe('verifySignature', () => {
    it('should verify valid ECDSA signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = generateTestECDSASignature(timestamp, payload, testPrivateKeyPem);

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
      const signature = generateTestECDSASignature(timestamp, originalPayload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, timestamp, tamperedPayload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 700).toString(); // 700 seconds ago
      const payload = '{"test": "data"}';
      const signature = generateTestECDSASignature(oldTimestamp, payload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, oldTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Timestamp too old');
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString(); // 400 seconds in future
      const payload = '{"test": "data"}';
      const signature = generateTestECDSASignature(futureTimestamp, payload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, futureTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Timestamp too far in future');
    });

    it('should reject invalid timestamp format', () => {
      const invalidTimestamp = 'not-a-number';
      const payload = '{"test": "data"}';
      const signature = generateTestECDSASignature('1234567890', payload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, invalidTimestamp, payload);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid timestamp format');
    });

    it('should handle missing parameters', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = generateTestECDSASignature(timestamp, payload, testPrivateKeyPem);

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
      const signature = generateTestECDSASignature(timestamp, payload, testPrivateKeyPem);

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
    });
  });

  describe('edge cases', () => {
    it('should handle very large payloads', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const largePayload = JSON.stringify({ data: 'x'.repeat(10000) });
      const signature = generateTestECDSASignature(timestamp, largePayload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, timestamp, largePayload);

      expect(result.isValid).toBe(true);
    });

    it('should handle special characters in payload', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const specialPayload = '{"text": "Hello 世界! 🌍 Special chars: àáâãäåæçèéêë"}';
      const signature = generateTestECDSASignature(timestamp, specialPayload, testPrivateKeyPem);

      const result = validator.verifySignature(signature, timestamp, specialPayload);

      expect(result.isValid).toBe(true);
    });

    it('should handle JSON with whitespace variations', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload1 = '{"test":"data"}';
      const payload2 = '{ "test" : "data" }';

      const signature1 = generateTestECDSASignature(timestamp, payload1, testPrivateKeyPem);
      const signature2 = generateTestECDSASignature(timestamp, payload2, testPrivateKeyPem);

      // Same signature should not work for different payloads (even with just whitespace differences)
      const result1 = validator.verifySignature(signature1, timestamp, payload2);
      const result2 = validator.verifySignature(signature2, timestamp, payload1);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });
  });
});

// Helper function to generate test ECDSA signatures
function generateTestECDSASignature(
  timestamp: string,
  payload: string,
  privateKeyPem: string
): string {
  const signedPayload = timestamp + payload;
  const signer = crypto.createSign('SHA256');
  signer.update(signedPayload, 'utf8');
  signer.end();

  return signer.sign(privateKeyPem).toString('base64');
}
