import crypto from 'crypto';
import { logger } from '@/libs/logger';
import { 
  SendGridSignatureVerification, 
  SendGridWebhookError,
  SendGridWebhookHeaders
} from '@/modules/webhooks/sendgrid.webhook.types';

/**
 * SendGrid Webhook Signature Validator
 * Implements HMAC-SHA256 signature verification for SendGrid Event Webhooks
 * Based on SendGrid's security documentation
 */
export class SendGridWebhookValidator {
  private readonly webhookSecret: string;
  private readonly maxTimestampAge: number;

  constructor(webhookSecret: string, maxTimestampAge: number = 600) { // 10 minutes default
    if (!webhookSecret) {
      throw new Error('SendGrid webhook secret is required');
    }
    this.webhookSecret = webhookSecret;
    this.maxTimestampAge = maxTimestampAge;
  }

  /**
   * Verify the SendGrid webhook signature and timestamp
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
      isValid: false
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

      // Step 3: Construct the signed payload
      const signedPayload = this.constructSignedPayload(timestamp, payload);

      // Step 4: Generate expected signature
      const expectedSignature = this.generateSignature(signedPayload);

      // Step 5: Compare signatures using constant-time comparison
      const isSignatureValid = this.constantTimeCompare(signature, expectedSignature);

      if (!isSignatureValid) {
        result.error = 'Signature verification failed';
        logger.warn('SendGrid webhook signature mismatch', {
          receivedSignature: signature,
          expectedSignature,
          timestamp,
          payloadLength: payload.length
        });
        return result;
      }

      result.isValid = true;
      logger.debug('SendGrid webhook signature verified successfully', {
        timestamp,
        payloadLength: payload.length
      });

      return result;

    } catch (error) {
      result.error = `Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error('SendGrid webhook signature verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
        payloadLength: payload?.length || 0
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
        error: 'Missing SendGrid signature or timestamp headers'
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
        error: `Timestamp too old: ${timestampAge}s (max: ${this.maxTimestampAge}s)` 
      };
    }

    // Check if timestamp is too far in the future (clock skew protection)
    if (timestampAge < -300) { // 5 minutes tolerance for future timestamps
      return { 
        isValid: false, 
        error: `Timestamp too far in future: ${Math.abs(timestampAge)}s` 
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
   * Generate HMAC-SHA256 signature
   * @param signedPayload - The payload to sign
   * @returns Base64 encoded signature
   */
  private generateSignature(signedPayload: string): string {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(signedPayload, 'utf8');
    return hmac.digest('base64');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings match
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate webhook configuration
   * @param config - Webhook configuration
   * @throws SendGridWebhookError if configuration is invalid
   */
  public static validateConfig(config: { webhookSecret?: string; maxTimestampAge?: number }): void {
    if (!config.webhookSecret) {
      throw new SendGridWebhookError(
        'SendGrid webhook secret is required',
        'MISSING_WEBHOOK_SECRET',
        500
      );
    }

    if (config.webhookSecret.length < 16) {
      throw new SendGridWebhookError(
        'SendGrid webhook secret must be at least 16 characters',
        'WEAK_WEBHOOK_SECRET',
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
    const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
    const maxTimestampAge = process.env.SENDGRID_WEBHOOK_MAX_AGE 
      ? parseInt(process.env.SENDGRID_WEBHOOK_MAX_AGE, 10)
      : 600;

    this.validateConfig({ webhookSecret, maxTimestampAge });

    return new SendGridWebhookValidator(webhookSecret!, maxTimestampAge);
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
  }
};