# TICKET-005: Create Base Email Provider Implementation

## **Priority:** High
## **Estimated Time:** 2-3 days
## **Phase:** 2 - Provider Factory and Base Implementation
## **Dependencies:** TICKET-004

---

## **Description**
Create an abstract base class that implements common functionality for all email providers. This class will handle validation, logging, error handling, and other shared concerns, reducing code duplication across provider implementations.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `BaseEmailProvider` abstract class implementing `EmailProvider`
- [ ] Implement common email request validation
- [ ] Provide standardized logging functionality
- [ ] Include error handling and normalization
- [ ] Implement helper methods for common operations
- [ ] Support provider configuration validation

### **Should Have**
- [ ] Rate limiting helper methods
- [ ] Retry logic framework
- [ ] Performance monitoring hooks
- [ ] Configuration caching

### **Could Have**
- [ ] Metrics collection framework
- [ ] Circuit breaker pattern implementation
- [ ] Request/response middleware support

## **Technical Requirements**

### **File Location**
```
server/src/libs/email/providers/BaseEmailProvider.ts
```

### **Core Implementation**

```typescript
import type { 
  EmailProvider, 
  EmailSendRequest, 
  EmailSendResult,
  EmailProviderCapabilities,
  ConnectionTestResult 
} from './EmailProvider.interface';
import type { BaseProviderConfig } from '../types/EmailConfig.types';
import { EmailProviderError, EMAIL_ERROR_CODES } from '../types/EmailErrors.types';
import { logger } from '@/libs/logger';

export abstract class BaseEmailProvider implements EmailProvider {
  protected readonly logger = logger;
  
  constructor(
    public readonly config: BaseProviderConfig,
    public readonly capabilities: EmailProviderCapabilities,
    public readonly providerType: string
  ) {}
  
  // Abstract methods that must be implemented
  abstract sendEmail(request: EmailSendRequest): Promise<EmailSendResult>;
  abstract testConnection(): Promise<ConnectionTestResult>;
  
  // Common validation methods
  protected validateSendRequest(request: EmailSendRequest): void {
    this.validateFromField(request.from);
    this.validateToField(request.to);
    this.validateSubject(request.subject);
    this.validateContent(request);
    this.validateLimits(request);
  }
  
  protected validateFromField(from: { email: string; name?: string }): void {
    if (!from?.email?.trim()) {
      throw new EmailProviderError(
        'From email is required',
        EMAIL_ERROR_CODES.INVALID_SENDER,
        400,
        this.providerType
      );
    }
    
    if (!this.isValidEmail(from.email)) {
      throw new EmailProviderError(
        'Invalid from email address',
        EMAIL_ERROR_CODES.INVALID_SENDER,
        400,
        this.providerType
      );
    }
  }
  
  protected validateToField(to: string | string[]): void {
    if (!to) {
      throw new EmailProviderError(
        'To email is required',
        EMAIL_ERROR_CODES.INVALID_RECIPIENT,
        400,
        this.providerType
      );
    }
    
    const recipients = Array.isArray(to) ? to : [to];
    
    if (recipients.length === 0) {
      throw new EmailProviderError(
        'At least one recipient is required',
        EMAIL_ERROR_CODES.INVALID_RECIPIENT,
        400,
        this.providerType
      );
    }
    
    if (recipients.length > this.capabilities.maxRecipientsPerEmail) {
      throw new EmailProviderError(
        `Too many recipients. Maximum allowed: ${this.capabilities.maxRecipientsPerEmail}`,
        EMAIL_ERROR_CODES.INVALID_RECIPIENT,
        400,
        this.providerType
      );
    }
    
    for (const email of recipients) {
      if (!this.isValidEmail(email)) {
        throw new EmailProviderError(
          `Invalid recipient email address: ${email}`,
          EMAIL_ERROR_CODES.INVALID_RECIPIENT,
          400,
          this.providerType
        );
      }
    }
  }
  
  protected validateSubject(subject: string): void {
    if (!subject?.trim()) {
      throw new EmailProviderError(
        'Subject is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        this.providerType
      );
    }
  }
  
  protected validateContent(request: EmailSendRequest): void {
    if (!request.html?.trim() && !request.text?.trim()) {
      throw new EmailProviderError(
        'Either HTML or text content is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        this.providerType
      );
    }
  }
  
  protected validateLimits(request: EmailSendRequest): void {
    if (this.capabilities.maxEmailSizeBytes) {
      const contentSize = (request.html || '').length + (request.text || '').length;
      if (contentSize > this.capabilities.maxEmailSizeBytes) {
        throw new EmailProviderError(
          `Email content too large. Maximum size: ${this.capabilities.maxEmailSizeBytes} bytes`,
          EMAIL_ERROR_CODES.MESSAGE_TOO_LARGE,
          413,
          this.providerType
        );
      }
    }
  }
  
  // Utility methods
  protected isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
  
  protected normalizeEmailAddress(email: string): string {
    return email.toLowerCase().trim();
  }
  
  protected sanitizeEmailContent(content: string): string {
    // Basic sanitization - can be extended
    return content.trim();
  }
  
  // Logging methods
  protected logOperation(operation: string, data: any): void {
    this.logger.info(`[${this.providerType}] ${operation}`, {
      provider: this.providerType,
      tenantId: this.config.tenantId,
      configId: this.config.id,
      configName: this.config.name,
      timestamp: new Date().toISOString(),
      ...data
    });
  }
  
  protected logError(operation: string, error: any, data?: any): void {
    this.logger.error(`[${this.providerType}] ${operation} failed`, {
      provider: this.providerType,
      tenantId: this.config.tenantId,
      configId: this.config.id,
      configName: this.config.name,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...data
    });
  }
  
  protected logDebug(operation: string, data: any): void {
    this.logger.debug(`[${this.providerType}] ${operation}`, {
      provider: this.providerType,
      tenantId: this.config.tenantId,
      configId: this.config.id,
      ...data
    });
  }
  
  // Rate limiting helpers
  protected async checkRateLimit(operation: string): Promise<void> {
    // Implementation depends on rate limiting strategy
    // Could integrate with Redis or in-memory rate limiter
    this.logDebug('checkRateLimit', { operation });
  }
  
  // Error handling helpers
  protected handleProviderError(error: any, operation: string): EmailProviderError {
    if (error instanceof EmailProviderError) {
      return error;
    }
    
    // Map common provider errors to our error codes
    const errorCode = this.mapErrorCode(error);
    const statusCode = this.mapStatusCode(error);
    
    return new EmailProviderError(
      error.message || `${operation} failed`,
      errorCode,
      statusCode,
      this.providerType,
      {
        originalError: error,
        operation,
        timestamp: new Date().toISOString(),
      }
    );
  }
  
  protected mapErrorCode(error: any): string {
    // Common error mapping - can be overridden by specific providers
    if (error.code === 'EAUTH' || error.code === 'ENOTFOUND') {
      return EMAIL_ERROR_CODES.INVALID_CREDENTIALS;
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return EMAIL_ERROR_CODES.CONNECTION_FAILED;
    }
    return EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE;
  }
  
  protected mapStatusCode(error: any): number {
    if (error.status) return error.status;
    if (error.statusCode) return error.statusCode;
    if (error.code === 'EAUTH') return 401;
    if (error.code === 'ECONNREFUSED') return 503;
    return 500;
  }
  
  // Performance monitoring
  protected async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.logOperation(`${operation}_completed`, {
        duration,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logError(`${operation}_failed`, error, {
        duration,
        success: false,
      });
      
      throw error;
    }
  }
}
```

## **Helper Utilities**

### **Email Validation**
- [ ] Comprehensive email format validation
- [ ] Domain validation (optional)
- [ ] Disposable email detection (optional)

### **Content Sanitization**
- [ ] HTML content sanitization
- [ ] Text content normalization
- [ ] Header validation

### **Rate Limiting**
- [ ] Token bucket implementation
- [ ] Redis-based distributed rate limiting
- [ ] Provider-specific rate limit handling

## **Testing Requirements**

### **Unit Tests**
- [ ] Test all validation methods
- [ ] Test error handling and mapping
- [ ] Test logging functionality
- [ ] Test utility methods

### **Test Files**
```
server/src/libs/email/providers/__tests__/BaseEmailProvider.test.ts
```

### **Mock Provider for Testing**
```typescript
class TestEmailProvider extends BaseEmailProvider {
  constructor() {
    super(
      mockConfig,
      mockCapabilities,
      'test'
    );
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    return { success: true, messageId: 'test-123' };
  }
  
  async testConnection(): Promise<ConnectionTestResult> {
    return { success: true };
  }
}
```

## **Performance Considerations**
- [ ] Efficient email validation
- [ ] Minimal memory footprint for logging
- [ ] Async operations where applicable
- [ ] Caching for repeated validations

## **Security Considerations**
- [ ] Sanitize log data to prevent information leakage
- [ ] Validate all inputs to prevent injection attacks
- [ ] Handle credentials securely
- [ ] Rate limiting to prevent abuse

## **Documentation Requirements**
- [ ] Comprehensive method documentation
- [ ] Implementation guide for extending the base class
- [ ] Best practices for error handling
- [ ] Performance optimization guidelines

## **Definition of Done**
- [ ] Base provider class implemented
- [ ] All validation methods working
- [ ] Logging integration completed
- [ ] Error handling framework implemented
- [ ] Unit tests written and passing
- [ ] Performance benchmarks established
- [ ] Security review completed
- [ ] Code review completed

## **Notes**
- Keep the base class focused on common functionality
- Allow providers to override default behavior where needed
- Ensure logging doesn't impact performance significantly
- Consider memory usage for high-volume scenarios

## **Related Tickets**
- TICKET-004: Email Provider Interface (prerequisite)
- TICKET-006: Email Provider Factory
- TICKET-009: SendGrid Provider Implementation
- TICKET-010: SMTP Provider Implementation