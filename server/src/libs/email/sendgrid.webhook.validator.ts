import crypto from 'crypto';
import { Buffer } from 'node:buffer';
import { logger } from '@/libs/logger';
import {
  SendGridSignatureVerification,
  SendGridWebhookError,
  SendGridWebhookHeaders,
} from '@/modules/webhooks/sendgrid.webhook.types';

/**
 * SendGrid Webhook Signature Validator
 * Implements ECDSA signature verification for SendGrid Event Webhooks
 * Based on SendGrid's security documentation using public key verification
 */
export class SendGridWebhookValidator {
  private readonly publicKey: string;
  private readonly maxTimestampAge: number;

  constructor(publicKey: string, maxTimestampAge: number = 600) {
    // 10 minutes default
    if (!publicKey) {
      throw new Error('SendGrid webhook public key is required');
    }
    this.publicKey = publicKey;
    this.maxTimestampAge = maxTimestampAge;
  }

  /**
   * Verify the SendGrid webhook signature and timestamp using ECDSA
   * @param signature - The signature from x-twilio-email-event-webhook-signature header
   * @param timestamp - The timestamp from x-twilio-email-event-webhook-timestamp header
   * @param payload - The raw request body as string
   * @returns Verification result with details
   */
  public verifySignature(
    signature: string,
    timestamp: string,
    payload: string
  ): SendGridSignatureVerification {
    const result: SendGridSignatureVerification = {
      signature,
      timestamp,
      payload,
      isValid: false,
    };

    try {
      // Step 1: Validate inputs
      if (!signature || !timestamp || payload === undefined) {
        result.error = 'Missing required signature, timestamp, or payload';
        return result;
      }

      // Step 2: Validate timestamp format and age
      const timestampValidation = this.validateTimestamp(timestamp);
      if (!timestampValidation.isValid) {
        result.error = timestampValidation.error;
        return result;
      }

      // Step 3: Construct the signed payload (timestamp + payload)
      const signedPayload = this.constructSignedPayload(timestamp, payload);

      // Step 4: Verify signature using ECDSA
      const isSignatureValid = this.verifyECDSASignature(signedPayload, signature);

      if (!isSignatureValid) {
        result.error = 'Signature verification failed';
        logger.warn('SendGrid webhook signature mismatch', {
          receivedSignature: signature,
          timestamp,
          payloadLength: payload.length,
          payload: payload,
        });
        return result;
      }

      result.isValid = true;
      logger.debug('SendGrid webhook signature verified successfully', {
        timestamp,
        payloadLength: payload.length,
      });

      return result;
    } catch (error) {
      result.error = `Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error('SendGrid webhook signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        payloadLength: payload?.length || 0,
      });
      return result;
    }
  }

  /**
   * Verify webhook from Fastify request headers and body
   * @param headers - Request headers
   * @param rawBody - Raw request body as string
   * @returns Verification result
   */
  public verifyWebhookRequest(
    headers: Partial<SendGridWebhookHeaders>,
    rawBody: string
  ): SendGridSignatureVerification {
    const signature = headers['x-twilio-email-event-webhook-signature'];
    const timestamp = headers['x-twilio-email-event-webhook-timestamp'];

    if (!signature || !timestamp) {
      return {
        signature: signature || '',
        timestamp: timestamp || '',
        payload: rawBody,
        isValid: false,
        error: 'Missing SendGrid signature or timestamp headers',
      };
    }

    return this.verifySignature(signature, timestamp, rawBody);
  }

  /**
   * Validate timestamp format and age
   * @param timestamp - Timestamp string from header
   * @returns Validation result
   */
  private validateTimestamp(timestamp: string): { isValid: boolean; error?: string } {
    // Parse timestamp
    const timestampNumber = parseInt(timestamp, 10);
    if (isNaN(timestampNumber)) {
      return { isValid: false, error: 'Invalid timestamp format' };
    }

    // Check if timestamp is too old (replay attack protection)
    const currentTime = Math.floor(Date.now() / 1000);
    const timestampAge = currentTime - timestampNumber;

    if (timestampAge > this.maxTimestampAge) {
      return {
        isValid: false,
        error: `Timestamp too old: ${timestampAge}s (max: ${this.maxTimestampAge}s)`,
      };
    }

    // Check if timestamp is too far in the future (clock skew protection)
    if (timestampAge < -300) {
      // 5 minutes tolerance for future timestamps
      return {
        isValid: false,
        error: `Timestamp too far in future: ${Math.abs(timestampAge)}s`,
      };
    }

    return { isValid: true };
  }

  /**
   * Construct the signed payload according to SendGrid specification
   * @param timestamp - Unix timestamp
   * @param payload - Request body
   * @returns Signed payload string
   */
  private constructSignedPayload(timestamp: string, payload: string): string {
    // SendGrid concatenates timestamp + payload for signing
    return timestamp + payload;
  }

  /**
   * Verify ECDSA signature using the public key
   * @param signedPayload - The payload to verify
   * @param signature - Base64 encoded signature
   * @returns True if signature is valid
   */
  private verifyECDSASignature(signedPayload: string, signature: string): boolean {
    try {
      // Create the public key object from base64 encoded key
      const publicKeyPem = this.convertBase64ToPEM(this.publicKey);

      // Create verifier
      const verifier = crypto.createVerify('SHA256');
      verifier.update(signedPayload, 'utf8');
      verifier.end();

      // Decode the signature from base64
      const signatureBuffer = Buffer.from(signature, 'base64');

      // Verify the signature
      return verifier.verify(publicKeyPem, signatureBuffer);
    } catch (error) {
      logger.error('ECDSA signature verification error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Convert base64 encoded public key to PEM format
   * @param base64Key - Base64 encoded public key
   * @returns PEM formatted public key
   */
  private convertBase64ToPEM(base64Key: string): string {
    // SendGrid provides the public key in base64 format
    // We need to convert it to PEM format for crypto.createVerify
    const pemHeader = '-----BEGIN PUBLIC KEY-----';
    const pemFooter = '-----END PUBLIC KEY-----';

    // Split the base64 key into 64-character lines
    const keyLines = base64Key.match(/.{1,64}/g) || [];

    return [pemHeader, ...keyLines, pemFooter].join('\n');
  }

  /**
   * Validate webhook configuration
   * @param config - Webhook configuration
   * @throws SendGridWebhookError if configuration is invalid
   */
  public static validateConfig(config: { publicKey?: string; maxTimestampAge?: number }): void {
    if (!config.publicKey) {
      throw new SendGridWebhookError(
        'SendGrid webhook public key is required',
        'MISSING_WEBHOOK_PUBLIC_KEY',
        500
      );
    }

    // Validate base64 format first
    try {
      Buffer.from(config.publicKey, 'base64');
    } catch (_error) {
      throw new SendGridWebhookError(
        'SendGrid webhook public key must be valid base64',
        'INVALID_PUBLIC_KEY_FORMAT',
        500
      );
    }

    // Then check length
    if (config.publicKey.length < 50) {
      throw new SendGridWebhookError(
        'SendGrid webhook public key appears to be too short',
        'INVALID_PUBLIC_KEY',
        500
      );
    }

    if (config.maxTimestampAge && (config.maxTimestampAge < 60 || config.maxTimestampAge > 3600)) {
      throw new SendGridWebhookError(
        'Max timestamp age must be between 60 and 3600 seconds',
        'INVALID_TIMESTAMP_AGE',
        500
      );
    }
  }

  /**
   * Create validator instance from environment variables
   * @returns Configured validator instance
   */
  public static fromEnvironment(): SendGridWebhookValidator {
    const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
    const maxTimestampAge = process.env.SENDGRID_WEBHOOK_MAX_AGE
      ? parseInt(process.env.SENDGRID_WEBHOOK_MAX_AGE, 10)
      : 600;

    this.validateConfig({ publicKey, maxTimestampAge });

    return new SendGridWebhookValidator(publicKey!, maxTimestampAge);
  }
}

// Export singleton instance factory (lazy initialization to avoid env issues during startup)
let _sendGridWebhookValidator: SendGridWebhookValidator | null = null;

export const sendGridWebhookValidator = {
  get instance(): SendGridWebhookValidator {
    if (!_sendGridWebhookValidator) {
      _sendGridWebhookValidator = SendGridWebhookValidator.fromEnvironment();
    }
    return _sendGridWebhookValidator;
  },
};
