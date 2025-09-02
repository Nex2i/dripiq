# TICKET-009: SendGrid Provider Implementation

## **Priority:** High
## **Estimated Time:** 2-3 days
## **Phase:** 4 - Implement Specific Email Providers
## **Dependencies:** TICKET-005, TICKET-006

---

## **Description**
Implement the SendGrid email provider by wrapping the existing SendGrid client in the new provider interface. This maintains backward compatibility while enabling the new provider abstraction system.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `SendGridProvider` class extending `BaseEmailProvider`
- [ ] Implement all required provider interface methods
- [ ] Wrap existing SendGrid client functionality
- [ ] Support SendGrid-specific features (categories, custom args, etc.)
- [ ] Maintain backward compatibility with existing SendGrid usage
- [ ] Include comprehensive error handling and mapping

### **Should Have**
- [ ] Implement SendGrid sender identity validation
- [ ] Support SendGrid email validation API
- [ ] Include SendGrid-specific capabilities
- [ ] Support IP pool configuration

### **Could Have**
- [ ] Support SendGrid templates
- [ ] Implement SendGrid suppression groups
- [ ] Add SendGrid-specific metrics

## **Technical Requirements**

### **File Location**
```
server/src/libs/email/providers/SendGridProvider.ts
```

### **Core Implementation**

```typescript
import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities,
  EmailValidationResult,
  SenderIdentityRequest,
  SenderIdentityResult,
  SenderVerificationRequest,
  SenderVerificationResult
} from './EmailProvider.interface';
import type { SendGridConfig } from '../types/EmailConfig.types';
import { EmailProviderError, EMAIL_ERROR_CODES } from '../types/EmailErrors.types';

export class SendGridProvider extends BaseEmailProvider {
  private sgMail = sgMail;
  private sgClient = sgClient;
  
  constructor(config: SendGridConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: true,
      supportsEmailValidation: true,
      supportsWebhooks: true,
      supportsTemplating: true,
      maxRecipientsPerEmail: 1000,
      maxEmailSizeBytes: 30 * 1024 * 1024, // 30MB
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        requestsPerHour: 36000,
      },
      supportedAuthMethods: ['api_key'],
      supportedContentTypes: ['text/plain', 'text/html'],
      supportsBulkOperations: true,
    };
    
    super(config, capabilities, 'sendgrid');
    
    // Initialize SendGrid clients
    this.sgMail.setApiKey(config.apiKey);
    this.sgClient.setApiKey(config.apiKey);
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    try {
      const startTime = Date.now();
      
      // Build SendGrid message object
      const msg = this.buildSendGridMessage(request);
      
      this.logOperation('sendEmail_start', {
        to: Array.isArray(request.to) ? request.to.length : 1,
        from: request.from.email,
        subject: request.subject,
        hasHtml: !!request.html,
        hasText: !!request.text,
      });
      
      // Send email via SendGrid
      const [response] = await this.sgMail.send(msg, false); // Disable built-in retry
      
      const duration = Date.now() - startTime;
      
      const result: EmailSendResult = {
        success: true,
        messageId: this.extractMessageId(response),
        providerMessageId: this.extractMessageId(response),
        statusCode: response.statusCode,
        metadata: {
          headers: response.headers,
          body: response.body,
          duration,
        }
      };
      
      this.logOperation('sendEmail_success', {
        messageId: result.messageId,
        statusCode: response.statusCode,
        duration,
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logError('sendEmail', error, { 
        request: this.sanitizeRequestForLogging(request),
        duration,
      });
      
      const mappedError = this.mapSendGridError(error);
      
      return {
        success: false,
        error: mappedError.message,
        statusCode: mappedError.statusCode,
        metadata: {
          originalError: error,
          errorCode: mappedError.code,
          duration,
        }
      };
    }
  }
  
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const startTime = Date.now();
      
      this.logOperation('testConnection_start', {});
      
      // Test API key by making a simple API call
      const request = {
        url: '/v3/user/profile',
        method: 'GET' as const,
      };
      
      const [response] = await this.sgClient.request(request);
      
      const duration = Date.now() - startTime;
      
      this.logOperation('testConnection_success', {
        statusCode: response.statusCode,
        duration,
      });
      
      return {
        success: true,
        latencyMs: duration,
        capabilities: this.capabilities,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logError('testConnection', error, { duration });
      
      const mappedError = this.mapSendGridError(error);
      
      return {
        success: false,
        error: mappedError.message,
        latencyMs: duration,
      };
    }
  }
  
  async validateEmail(email: string): Promise<EmailValidationResult> {
    try {
      this.logOperation('validateEmail_start', { email });
      
      const data = {
        email: email,
        source: 'signup', // or 'lead_list'
      };

      const request = {
        url: '/v3/validations/email',
        method: 'POST' as const,
        body: data,
      };

      const [response, body] = await this.sgClient.request(request);
      
      // SendGrid's validation API returns different response formats
      // This is a simplified implementation
      const result: EmailValidationResult = {
        email,
        isValid: response.statusCode === 200,
        confidence: 0.9, // SendGrid doesn't provide confidence scores
      };
      
      if (body && typeof body === 'object') {
        result.reason = (body as any).verdict;
      }
      
      this.logOperation('validateEmail_success', {
        email,
        isValid: result.isValid,
        verdict: result.reason,
      });
      
      return result;
    } catch (error: any) {
      this.logError('validateEmail', error, { email });
      
      // Return a default result rather than throwing
      return {
        email,
        isValid: false,
        reason: 'validation_failed',
        confidence: 0,
      };
    }
  }
  
  async createSenderIdentity(request: SenderIdentityRequest): Promise<SenderIdentityResult> {
    try {
      this.logOperation('createSenderIdentity_start', {
        email: request.email,
        name: request.name,
      });
      
      const data = {
        nickname: request.name,
        from_email: request.email,
        from_name: request.name,
        reply_to: request.email,
        reply_to_name: request.name,
        address: request.address || '',
        city: request.city || '',
        country: request.country || 'USA',
      };

      const sgRequest = {
        url: '/v3/verified_senders',
        method: 'POST' as const,
        body: data,
      };

      const [response, body] = await this.sgClient.request(sgRequest);
      
      const identityId = this.extractSendGridId(body);
      
      const result: SenderIdentityResult = {
        success: true,
        identityId,
        verificationRequired: true,
        verificationMethod: 'email',
      };
      
      this.logOperation('createSenderIdentity_success', {
        email: request.email,
        identityId,
      });
      
      return result;
    } catch (error: any) {
      this.logError('createSenderIdentity', error, { request });
      
      const mappedError = this.mapSendGridError(error);
      
      return {
        success: false,
        error: mappedError.message,
      };
    }
  }
  
  async verifySenderIdentity(request: SenderVerificationRequest): Promise<SenderVerificationResult> {
    try {
      this.logOperation('verifySenderIdentity_start', {
        identityId: request.identityId,
      });
      
      if (request.verificationUrl) {
        // Extract token from URL and verify
        const token = this.extractVerificationToken(request.verificationUrl);
        const sgRequest = {
          url: `/v3/verified_senders/verify/${token}`,
          method: 'GET' as const,
        };
        
        const [response] = await this.sgClient.request(sgRequest);
        
        const verified = response.statusCode >= 200 && response.statusCode < 300;
        
        this.logOperation('verifySenderIdentity_success', {
          identityId: request.identityId,
          verified,
        });
        
        return {
          success: true,
          verified,
        };
      } else if (request.identityId) {
        // Resend verification email
        const sgRequest = {
          url: `/v3/verified_senders/resend/${request.identityId}`,
          method: 'POST' as const,
        };
        
        await this.sgClient.request(sgRequest);
        
        return {
          success: true,
          verified: false,
          requiresAdditionalSteps: true,
          nextSteps: ['Check email for verification link'],
        };
      }
      
      return {
        success: false,
        verified: false,
        error: 'Invalid verification request',
      };
    } catch (error: any) {
      this.logError('verifySenderIdentity', error, { request });
      
      const mappedError = this.mapSendGridError(error);
      
      return {
        success: false,
        verified: false,
        error: mappedError.message,
      };
    }
  }
  
  // Private helper methods
  
  private buildSendGridMessage(request: EmailSendRequest): any {
    const msg: any = {
      from: request.from,
      to: request.to,
      subject: request.subject,
      headers: request.headers,
    };
    
    // Add content
    if (request.html) {
      msg.html = request.html;
    }
    if (request.text) {
      msg.text = request.text;
    }
    
    // Add SendGrid-specific features
    if (request.categories && request.categories.length > 0) {
      msg.categories = request.categories;
    }
    
    if (request.metadata) {
      msg.customArgs = this.buildCustomArgs(request.metadata);
    }
    
    // Add IP pool if configured
    const config = this.config as SendGridConfig;
    if (config.ipPoolName) {
      msg.ipPoolName = config.ipPoolName;
    }
    
    return msg;
  }
  
  private buildCustomArgs(metadata: Record<string, any>): Record<string, string> {
    const customArgs: Record<string, string> = {};
    
    // Convert all metadata to strings for SendGrid
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        customArgs[key] = String(value);
      }
    }
    
    return customArgs;
  }
  
  private extractMessageId(response: any): string | undefined {
    // SendGrid returns message ID in X-Message-Id header
    const headers = response.headers as Record<string, string | string[] | undefined>;
    return (headers['x-message-id'] as string) || 
           (headers['X-Message-Id'] as string) ||
           undefined;
  }
  
  private extractSendGridId(body: unknown): string | undefined {
    if (body && typeof body === 'object' && 'id' in body) {
      const id = (body as { id?: unknown }).id;
      return typeof id === 'string' ? id : undefined;
    }
    return undefined;
  }
  
  private extractVerificationToken(url: string): string {
    // Extract token from SendGrid verification URL
    const match = url.match(/\/verify\/([^/?]+)/);
    return match ? match[1] : '';
  }
  
  private mapSendGridError(error: any): { message: string; code: string; statusCode: number } {
    // Map SendGrid-specific errors to our error codes
    const statusCode = error.code || error.response?.status || 500;
    
    if (statusCode === 401 || statusCode === 403) {
      return {
        message: 'Invalid SendGrid API key or insufficient permissions',
        code: EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        statusCode: 401,
      };
    }
    
    if (statusCode === 429) {
      return {
        message: 'SendGrid rate limit exceeded',
        code: EMAIL_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      };
    }
    
    if (statusCode >= 400 && statusCode < 500) {
      // Check for specific SendGrid error messages
      const sgErrors = error.response?.body?.errors || [];
      if (sgErrors.length > 0) {
        const errorMessages = sgErrors.map((e: any) => e.message).join(', ');
        return {
          message: `SendGrid validation error: ${errorMessages}`,
          code: EMAIL_ERROR_CODES.INVALID_CONFIG,
          statusCode,
        };
      }
      
      return {
        message: error.message || 'SendGrid request failed',
        code: EMAIL_ERROR_CODES.INVALID_CONFIG,
        statusCode,
      };
    }
    
    if (statusCode >= 500) {
      return {
        message: 'SendGrid service unavailable',
        code: EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
        statusCode,
      };
    }
    
    return {
      message: error.message || 'Unknown SendGrid error',
      code: EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
      statusCode: 500,
    };
  }
  
  private sanitizeRequestForLogging(request: EmailSendRequest): any {
    return {
      from: request.from,
      toCount: Array.isArray(request.to) ? request.to.length : 1,
      subject: request.subject,
      hasHtml: !!request.html,
      hasText: !!request.text,
      categoriesCount: request.categories?.length || 0,
      metadataKeys: request.metadata ? Object.keys(request.metadata) : [],
    };
  }
}
```

## **Backward Compatibility**

### **Legacy Integration Points**
- [ ] Maintain compatibility with existing `sendgridClient` usage
- [ ] Support existing custom args format
- [ ] Preserve existing error handling behavior
- [ ] Support existing webhook validation

### **Migration Strategy**
- [ ] Provider can be used as drop-in replacement
- [ ] Existing configurations should work without changes
- [ ] Support gradual migration from direct client usage

## **SendGrid-Specific Features**

### **Advanced Features**
- [ ] Support for SendGrid categories
- [ ] Custom arguments for tracking
- [ ] IP pool configuration
- [ ] Suppression group management (ASM)

### **Webhook Integration**
- [ ] Support existing webhook signature validation
- [ ] Maintain webhook event format compatibility
- [ ] Support webhook public key configuration

## **Testing Requirements**

### **Unit Tests**
- [ ] Test email sending with various configurations
- [ ] Test connection validation
- [ ] Test error handling and mapping
- [ ] Test SendGrid-specific features

### **Integration Tests**
- [ ] Test with real SendGrid API (sandbox mode)
- [ ] Test sender identity creation and verification
- [ ] Test email validation functionality

### **Test Files**
```
server/src/libs/email/providers/__tests__/SendGridProvider.test.ts
server/src/libs/email/providers/__tests__/SendGridProvider.integration.test.ts
```

### **Mock SendGrid for Testing**
```typescript
// Mock SendGrid client for unit tests
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

jest.mock('@sendgrid/client', () => ({
  setApiKey: jest.fn(),
  request: jest.fn(),
}));
```

## **Performance Considerations**
- [ ] Efficient message building
- [ ] Minimal overhead over direct SendGrid usage
- [ ] Proper async/await usage
- [ ] Memory management for large messages

## **Security Considerations**
- [ ] Secure API key handling
- [ ] Sanitize logged data to prevent key leakage
- [ ] Validate all inputs to prevent injection
- [ ] Handle webhook signature validation securely

## **Monitoring and Observability**
- [ ] Comprehensive logging for all operations
- [ ] Metrics collection for success/failure rates
- [ ] Performance monitoring
- [ ] Error rate tracking

## **Documentation Requirements**
- [ ] Document SendGrid-specific configuration options
- [ ] Include migration guide from direct SendGrid usage
- [ ] Document advanced features and limitations
- [ ] Provide troubleshooting guide

## **Error Handling**

### **SendGrid Error Mapping**
- [ ] Map SendGrid API errors to standard error codes
- [ ] Handle rate limiting gracefully
- [ ] Preserve original error context for debugging
- [ ] Support retry recommendations

### **Common SendGrid Errors**
- 401: Invalid API key
- 403: Insufficient permissions
- 429: Rate limit exceeded
- 400: Validation errors

## **Definition of Done**
- [ ] SendGrid provider fully implemented
- [ ] All interface methods working correctly
- [ ] Backward compatibility maintained
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Ensure no regression in existing SendGrid functionality
- Consider migration path for existing sender identities
- Plan for SendGrid webhook integration updates
- Maintain existing error handling patterns where possible

## **Related Tickets**
- TICKET-005: Base Email Provider (prerequisite)
- TICKET-006: Email Provider Factory (prerequisite)
- TICKET-010: SMTP Provider Implementation
- TICKET-015: Refactor EmailProcessor Integration