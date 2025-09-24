import { Socket } from 'net';
import { SmtpValidationResult } from '../types/emailValidation.types';

/**
 * Infrastructure service for SMTP-based email validation
 * Note: Many mail servers block or rate-limit SMTP validation attempts
 */
export class SmtpValidator {
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(timeout: number = 10000, maxRetries: number = 1) {
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  /**
   * Validates an email address via SMTP
   * This is a simplified implementation - production versions need more robust error handling
   */
  async validateEmail(email: string, mxRecord: string): Promise<SmtpValidationResult> {
    if (!mxRecord) {
      return {
        isValid: false,
        isCatchAll: false,
        errorMessage: 'No MX record provided',
      };
    }

    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const result = await this.attemptSmtpValidation(email, mxRecord);
        return result;
      } catch (error) {
        attempt++;
        if (attempt >= this.maxRetries) {
          return {
            isValid: false,
            isCatchAll: false,
            errorMessage: `SMTP validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }

    return {
      isValid: false,
      isCatchAll: false,
      errorMessage: 'Max retries exceeded',
    };
  }

  /**
   * Attempts SMTP validation for an email address
   */
  private async attemptSmtpValidation(
    email: string,
    mxRecord: string
  ): Promise<SmtpValidationResult> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      let isResolved = false;
      const responses: string[] = [];

      const resolveOnce = (result: SmtpValidationResult) => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      const rejectOnce = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          socket.destroy();
          reject(error);
        }
      };

      // Set timeout
      const timer = setTimeout(() => {
        rejectOnce(new Error('SMTP connection timeout'));
      }, this.timeout);

      socket.setTimeout(this.timeout);

      socket.connect(25, mxRecord, () => {
        // Connected to SMTP server
      });

      socket.on('data', (data) => {
        const response = data.toString().trim();
        responses.push(response);

        if (response.startsWith('220')) {
          // Server ready, send HELO
          socket.write('HELO example.com\r\n');
        } else if (response.startsWith('250') && responses.length === 2) {
          // HELO accepted, send MAIL FROM
          socket.write('MAIL FROM:<test@example.com>\r\n');
        } else if (response.startsWith('250') && responses.length === 3) {
          // MAIL FROM accepted, send RCPT TO
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (response.startsWith('250') && responses.length === 4) {
          // Email exists and is valid
          clearTimeout(timer);
          resolveOnce({
            isValid: true,
            isCatchAll: false,
            errorMessage: null,
          });
        } else if (
          response.startsWith('550') ||
          response.startsWith('551') ||
          response.startsWith('553')
        ) {
          // Email doesn't exist or is rejected
          clearTimeout(timer);
          resolveOnce({
            isValid: false,
            isCatchAll: false,
            errorMessage: response,
          });
        } else if (
          response.startsWith('450') ||
          response.startsWith('451') ||
          response.startsWith('452')
        ) {
          // Temporary failure - treat as unknown
          clearTimeout(timer);
          resolveOnce({
            isValid: false,
            isCatchAll: false,
            errorMessage: `Temporary failure: ${response}`,
          });
        } else if (response.includes('catch-all') || response.includes('catchall')) {
          // Catch-all domain detected
          clearTimeout(timer);
          resolveOnce({
            isValid: true,
            isCatchAll: true,
            errorMessage: null,
          });
        }
      });

      socket.on('error', (error) => {
        clearTimeout(timer);
        rejectOnce(error);
      });

      socket.on('timeout', () => {
        clearTimeout(timer);
        rejectOnce(new Error('Socket timeout'));
      });

      socket.on('close', () => {
        clearTimeout(timer);
        if (!isResolved) {
          rejectOnce(new Error('Connection closed unexpectedly'));
        }
      });
    });
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Quick check if SMTP validation should be attempted
   * Skips validation for known problematic domains and specific MX patterns
   */
  shouldAttemptSmtpValidation(domain: string, mxRecord?: string): boolean {
    const problematicDomains = new Set([
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
      'aol.com',
    ]);

    // Check domain directly - these providers always block SMTP validation
    if (problematicDomains.has(domain.toLowerCase())) {
      return false;
    }

    // Check for specific MX providers that are known to block SMTP validation
    if (mxRecord) {
      const lowerMx = mxRecord.toLowerCase();
      
      // Skip Microsoft-hosted business emails - they consistently block SMTP validation
      if (lowerMx.includes('mail.protection.outlook.com')) {
        return false;
      }
      
      // Allow Google Workspace MX records (aspmx.l.google.com) as they may provide useful results
      // Only skip the direct Gmail consumer MX records
      if (lowerMx.includes('gmail-smtp-in.l.google.com')) {
        return false;
      }
    }

    return true;
  }
}
