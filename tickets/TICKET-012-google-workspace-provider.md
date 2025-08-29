# TICKET-012: Google Workspace Provider Implementation

## **Priority:** Medium
## **Estimated Time:** 4-5 days
## **Phase:** 4 - Implement Specific Email Providers
## **Dependencies:** TICKET-005, TICKET-006

---

## **Description**
Implement Google Workspace (Gmail API) email provider for Google Workspace integration. This provider will use the Gmail API to send emails through customer's Google Workspace accounts, supporting service account authentication with domain-wide delegation.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `GoogleWorkspaceProvider` class extending `BaseEmailProvider`
- [ ] Support service account authentication with domain-wide delegation
- [ ] Implement email sending via Gmail API
- [ ] Support OAuth2 token management and refresh
- [ ] Include comprehensive error handling for Gmail API errors
- [ ] Support impersonation of domain users

### **Should Have**
- [ ] Support OAuth2 user authentication flow
- [ ] Implement connection testing via Gmail API
- [ ] Support Gmail API rate limiting
- [ ] Include message tracking capabilities

### **Could Have**
- [ ] Support for Gmail API webhooks (push notifications)
- [ ] Integration with Google Calendar for meeting requests
- [ ] Support for Gmail labels and filters

## **Technical Requirements**

### **Dependencies**
```json
{
  "dependencies": {
    "googleapis": "^126.0.1",
    "google-auth-library": "^9.5.0"
  }
}
```

### **File Location**
```
server/src/libs/email/providers/GoogleWorkspaceProvider.ts
```

### **Core Implementation**

```typescript
import { google } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import type { gmail_v1 } from 'googleapis';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
} from './EmailProvider.interface';
import type { GoogleWorkspaceConfig } from '../types/EmailConfig.types';
import { EmailProviderError, EMAIL_ERROR_CODES } from '../types/EmailErrors.types';

export class GoogleWorkspaceProvider extends BaseEmailProvider {
  private gmail: gmail_v1.Gmail | null = null;
  private auth: JWT | OAuth2Client | null = null;
  private tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();
  
  constructor(private googleConfig: GoogleWorkspaceConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: false, // Gmail API doesn't provide sender validation
      supportsEmailValidation: false,  // Gmail API doesn't provide email validation
      supportsWebhooks: true,          // Gmail API supports push notifications
      supportsTemplating: false,       // Basic Gmail API doesn't support templating
      maxRecipientsPerEmail: 100,      // Gmail API conservative limit
      maxEmailSizeBytes: 25 * 1024 * 1024, // 25MB limit
      rateLimits: {
        requestsPerSecond: 5,    // Gmail API quota limits
        requestsPerMinute: 250,  // ~4 requests per second
        requestsPerHour: 15000,  // Gmail API daily quotas
      },
      supportedAuthMethods: ['service_account', 'oauth2'],
      supportedContentTypes: ['text/plain', 'text/html'],
      supportsBulkOperations: false, // Send individual emails
    };
    
    super(googleConfig, capabilities, 'google_workspace');
  }
  
  async initialize(): Promise<void> {
    this.logOperation('initialize_start', {
      projectId: this.googleConfig.projectId,
      authType: this.googleConfig.authType,
      clientEmail: this.googleConfig.clientEmail,
    });
    
    try {
      // Initialize authentication
      if (this.googleConfig.authType === 'service_account') {
        await this.initializeServiceAccount();
      } else if (this.googleConfig.authType === 'oauth2') {
        await this.initializeOAuth2();
      } else {
        throw new EmailProviderError(
          `Unsupported auth type: ${this.googleConfig.authType}`,
          EMAIL_ERROR_CODES.INVALID_CONFIG,
          400,
          this.providerType
        );
      }
      
      // Initialize Gmail client
      this.gmail = google.gmail({ version: 'v1', auth: this.auth! });
      
      // Test the connection
      await this.testConnection();
      
      this.logOperation('initialize_success', {
        projectId: this.googleConfig.projectId,
        authType: this.googleConfig.authType,
      });
    } catch (error) {
      this.logError('initialize', error);
      throw this.handleProviderError(error, 'initialize');
    }
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    // Ensure Gmail client is initialized
    if (!this.gmail) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      
      // Build raw email message
      const rawEmail = this.createRawEmail(request);
      
      this.logOperation('sendEmail_start', {
        to: Array.isArray(request.to) ? request.to.length : 1,
        from: request.from.email,
        subject: request.subject,
        hasHtml: !!request.html,
        hasText: !!request.text,
      });
      
      // Send email via Gmail API
      const response = await this.gmail!.users.messages.send({
        userId: this.getUserId(request.from.email),
        requestBody: {
          raw: Buffer.from(rawEmail).toString('base64url'),
        },
      });
      
      const duration = Date.now() - startTime;
      
      const result: EmailSendResult = {
        success: true,
        messageId: response.data.id || this.generateMessageId(),
        providerMessageId: response.data.id,
        metadata: {
          gmailResponse: response.data,
          threadId: response.data.threadId,
          duration,
          apiVersion: 'v1',
        }
      };
      
      this.logOperation('sendEmail_success', {
        messageId: result.messageId,
        threadId: response.data.threadId,
        duration,
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logError('sendEmail', error, { 
        request: this.sanitizeRequestForLogging(request),
        duration,
      });
      
      const mappedError = this.mapGmailError(error);
      
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
      
      this.logOperation('testConnection_start', {
        projectId: this.googleConfig.projectId,
        authType: this.googleConfig.authType,
      });
      
      if (!this.gmail) {
        await this.initialize();
      }
      
      // Test connection by getting user profile
      const profile = await this.gmail!.users.getProfile({ 
        userId: this.getUserIdForTest() 
      });
      
      const duration = Date.now() - startTime;
      
      this.logOperation('testConnection_success', {
        emailAddress: profile.data.emailAddress,
        messagesTotal: profile.data.messagesTotal,
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
      
      const mappedError = this.mapGmailError(error);
      
      return {
        success: false,
        error: mappedError.message,
        latencyMs: duration,
      };
    }
  }
  
  async cleanup(): Promise<void> {
    this.logOperation('cleanup_start', {});
    
    try {
      // Clear token cache
      this.tokenCache.clear();
      
      // Reset clients
      this.gmail = null;
      this.auth = null;
      
      this.logOperation('cleanup_success', {});
    } catch (error) {
      this.logError('cleanup', error);
    }
  }
  
  // Private helper methods
  
  private async initializeServiceAccount(): Promise<void> {
    if (!this.googleConfig.clientEmail || !this.googleConfig.privateKey) {
      throw new EmailProviderError(
        'Service account credentials (clientEmail and privateKey) are required',
        EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        400,
        this.providerType
      );
    }
    
    this.auth = new JWT({
      email: this.googleConfig.clientEmail,
      key: this.googleConfig.privateKey.replace(/\\n/g, '\n'),
      scopes: this.googleConfig.scopes,
      subject: this.googleConfig.delegatedUser, // For domain-wide delegation
    });
  }
  
  private async initializeOAuth2(): Promise<void> {
    if (!this.googleConfig.clientId || !this.googleConfig.clientSecret) {
      throw new EmailProviderError(
        'OAuth2 credentials (clientId and clientSecret) are required',
        EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        400,
        this.providerType
      );
    }
    
    // OAuth2 implementation would require user consent flow
    // This is more complex and typically handled at the application level
    throw new EmailProviderError(
      'OAuth2 authentication not yet implemented for Google Workspace',
      EMAIL_ERROR_CODES.INVALID_CONFIG,
      400,
      this.providerType
    );
  }
  
  private createRawEmail(request: EmailSendRequest): string {
    const recipients = Array.isArray(request.to) ? request.to.join(', ') : request.to;
    
    let email = [
      `From: ${this.formatEmailAddress(request.from.email, request.from.name)}`,
      `To: ${recipients}`,
      `Subject: ${request.subject}`,
      'MIME-Version: 1.0',
    ];
    
    // Add custom headers
    if (request.headers) {
      for (const [name, value] of Object.entries(request.headers)) {
        email.push(`${name}: ${value}`);
      }
    }
    
    // Add metadata as custom headers
    if (request.metadata) {
      for (const [key, value] of Object.entries(request.metadata)) {
        if (value !== null && value !== undefined) {
          const headerName = key.startsWith('X-') ? key : `X-${key}`;
          email.push(`${headerName}: ${String(value)}`);
        }
      }
    }
    
    // Handle multipart content (HTML and text)
    if (request.html && request.text) {
      const boundary = '----=_Part_' + Date.now() + '_' + Math.random().toString(36);
      email.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      email.push('');
      
      // Text part
      email.push(`--${boundary}`);
      email.push('Content-Type: text/plain; charset=UTF-8');
      email.push('Content-Transfer-Encoding: 7bit');
      email.push('');
      email.push(request.text);
      email.push('');
      
      // HTML part
      email.push(`--${boundary}`);
      email.push('Content-Type: text/html; charset=UTF-8');
      email.push('Content-Transfer-Encoding: 7bit');
      email.push('');
      email.push(request.html);
      email.push('');
      email.push(`--${boundary}--`);
    } else if (request.html) {
      email.push('Content-Type: text/html; charset=UTF-8');
      email.push('Content-Transfer-Encoding: 7bit');
      email.push('');
      email.push(request.html);
    } else {
      email.push('Content-Type: text/plain; charset=UTF-8');
      email.push('Content-Transfer-Encoding: 7bit');
      email.push('');
      email.push(request.text || '');
    }
    
    return email.join('\r\n');
  }
  
  private formatEmailAddress(email: string, name?: string): string {
    if (name && name.trim()) {
      // Escape name if it contains special characters
      const escapedName = name.includes(',') || name.includes('"') 
        ? `"${name.replace(/"/g, '\\"')}"` 
        : name;
      return `${escapedName} <${email}>`;
    }
    return email;
  }
  
  private getUserId(fromEmail: string): string {
    // For service account with domain-wide delegation, we can impersonate users
    if (this.googleConfig.authType === 'service_account' && this.googleConfig.delegatedUser) {
      return this.googleConfig.delegatedUser;
    }
    
    // For regular authentication, use 'me' or the from email
    return fromEmail || 'me';
  }
  
  private getUserIdForTest(): string {
    // For connection testing
    if (this.googleConfig.authType === 'service_account' && this.googleConfig.delegatedUser) {
      return this.googleConfig.delegatedUser;
    }
    
    return 'me';
  }
  
  private generateMessageId(): string {
    // Generate a unique message ID as fallback
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `gmail-${timestamp}-${random}`;
  }
  
  private mapGmailError(error: any): { message: string; code: string; statusCode: number } {
    const statusCode = error.status || error.code || 500;
    const errorDetails = error.errors?.[0] || error.error || error;
    
    // Authentication errors
    if (statusCode === 401 || errorDetails.reason === 'authError') {
      return {
        message: 'Gmail API authentication failed. Check service account credentials.',
        code: EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        statusCode: 401,
      };
    }
    
    if (statusCode === 403) {
      if (errorDetails.reason === 'insufficientPermissions') {
        return {
          message: 'Insufficient permissions for Gmail API. Check service account scopes.',
          code: EMAIL_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          statusCode: 403,
        };
      }
      
      if (errorDetails.reason === 'domainPolicy') {
        return {
          message: 'Gmail API access restricted by domain policy',
          code: EMAIL_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          statusCode: 403,
        };
      }
    }
    
    // Rate limiting
    if (statusCode === 429 || errorDetails.reason === 'rateLimitExceeded') {
      return {
        message: 'Gmail API rate limit exceeded',
        code: EMAIL_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      };
    }
    
    // Quota exceeded
    if (errorDetails.reason === 'quotaExceeded') {
      return {
        message: 'Gmail API quota exceeded',
        code: EMAIL_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      };
    }
    
    // Request validation errors
    if (statusCode === 400) {
      const message = errorDetails.message || 'Invalid request to Gmail API';
      return {
        message: `Gmail API validation error: ${message}`,
        code: EMAIL_ERROR_CODES.INVALID_CONFIG,
        statusCode: 400,
      };
    }
    
    // Server errors
    if (statusCode >= 500) {
      return {
        message: 'Gmail API service unavailable',
        code: EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
        statusCode,
      };
    }
    
    // Unknown error
    return {
      message: errorDetails.message || error.message || 'Unknown Gmail API error',
      code: EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
      statusCode: statusCode || 500,
    };
  }
  
  private sanitizeRequestForLogging(request: EmailSendRequest): any {
    return {
      from: request.from,
      toCount: Array.isArray(request.to) ? request.to.length : 1,
      subject: request.subject,
      hasHtml: !!request.html,
      hasText: !!request.text,
      metadataKeys: request.metadata ? Object.keys(request.metadata) : [],
    };
  }
}
```

## **Google Workspace Configuration**

### **Required Google Cloud Project Setup**
1. **Create Google Cloud Project:**
   - Create project in Google Cloud Console
   - Enable Gmail API
   - Create service account credentials

2. **Service Account Setup:**
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "key-id",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "service-account@your-project.iam.gserviceaccount.com",
     "client_id": "123456789",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token"
   }
   ```

3. **Domain-Wide Delegation:**
   - Enable domain-wide delegation for service account
   - Add client ID to Google Admin Console
   - Grant necessary OAuth scopes

4. **Required Scopes:**
   ```
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.readonly (for connection testing)
   ```

### **Configuration Helper**
**File:** `server/src/libs/email/providers/GoogleWorkspaceHelper.ts`

```typescript
export class GoogleWorkspaceHelper {
  /**
   * Validate Google Workspace configuration
   */
  static validateConfig(config: GoogleWorkspaceConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.projectId) {
      errors.push('Google Cloud project ID is required');
    }
    
    if (config.authType === 'service_account') {
      if (!config.clientEmail) {
        errors.push('Service account client email is required');
      }
      
      if (!config.privateKey) {
        errors.push('Service account private key is required');
      }
      
      if (!config.delegatedUser) {
        errors.push('Delegated user email is required for domain-wide delegation');
      }
    }
    
    if (config.authType === 'oauth2') {
      if (!config.clientId) {
        errors.push('OAuth2 client ID is required');
      }
      
      if (!config.clientSecret) {
        errors.push('OAuth2 client secret is required');
      }
    }
    
    if (!config.scopes || config.scopes.length === 0) {
      errors.push('At least one scope is required');
    }
    
    // Validate required scopes
    const requiredScopes = ['https://www.googleapis.com/auth/gmail.send'];
    const hasRequiredScopes = requiredScopes.every(scope => 
      config.scopes.includes(scope)
    );
    
    if (!hasRequiredScopes) {
      errors.push('gmail.send scope is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Get default scopes for email sending
   */
  static getDefaultScopes(): string[] {
    return [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
    ];
  }
  
  /**
   * Format service account private key
   */
  static formatPrivateKey(privateKey: string): string {
    // Ensure proper newline formatting
    return privateKey.replace(/\\n/g, '\n');
  }
  
  /**
   * Validate service account email format
   */
  static isValidServiceAccountEmail(email: string): boolean {
    return email.endsWith('.iam.gserviceaccount.com');
  }
}
```

## **Testing Requirements**

### **Unit Tests**
- [ ] Test raw email message creation
- [ ] Test error handling and mapping
- [ ] Test service account authentication
- [ ] Test connection validation

### **Integration Tests**
- [ ] Test with real Gmail API (test Google Workspace domain)
- [ ] Test service account authentication with domain-wide delegation
- [ ] Test email sending functionality
- [ ] Test rate limiting handling

### **Test Files**
```
server/src/libs/email/providers/__tests__/GoogleWorkspaceProvider.test.ts
server/src/libs/email/providers/__tests__/GoogleWorkspaceProvider.integration.test.ts
server/src/libs/email/providers/__tests__/GoogleWorkspaceHelper.test.ts
```

### **Mock Google APIs for Testing**
```typescript
// Mock Google APIs
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        messages: {
          send: jest.fn(),
        },
        getProfile: jest.fn(),
      },
    })),
  },
}));

// Mock Google Auth Library
jest.mock('google-auth-library', () => ({
  JWT: jest.fn(),
  OAuth2Client: jest.fn(),
}));
```

## **Rate Limiting and Quotas**

### **Gmail API Limits**
- **Send quota**: 1 billion quota units per day
- **Per-user rate limit**: 250 quota units per user per second
- **Send message**: 100 quota units per request

### **Quota Management**
- [ ] Implement quota tracking and monitoring
- [ ] Handle quota exceeded errors gracefully
- [ ] Respect exponential backoff for rate limiting
- [ ] Monitor daily quota usage

## **Security Considerations**
- [ ] Secure service account private key storage
- [ ] Validate domain-wide delegation setup
- [ ] Audit logging for API calls
- [ ] Principle of least privilege for scopes
- [ ] Secure handling of delegated user credentials

## **Domain-Wide Delegation Setup**

### **Google Admin Console Configuration**
1. **Security > API Controls > Domain-wide Delegation**
2. **Add service account client ID**
3. **Grant OAuth scopes:**
   ```
   https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.readonly
   ```

### **Verification Steps**
- [ ] Verify service account has domain-wide delegation
- [ ] Test with delegated user account
- [ ] Validate scopes are properly granted
- [ ] Confirm API access is working

## **Monitoring and Observability**
- [ ] Log all Gmail API interactions
- [ ] Monitor quota usage and limits
- [ ] Track API latency and success rates
- [ ] Alert on quota threshold breaches

## **Documentation Requirements**
- [ ] Document Google Cloud project setup
- [ ] Include service account creation guide
- [ ] Document domain-wide delegation process
- [ ] Provide troubleshooting guide for common issues

## **Limitations and Considerations**

### **Gmail API Limitations**
- Requires Google Workspace (not personal Gmail)
- Domain-wide delegation requires admin privileges
- Subject to Google's API quotas and rate limits
- Complex setup process for service accounts

### **Authentication Considerations**
- Service account with domain-wide delegation preferred
- OAuth2 requires user consent for each user
- Private key security is critical
- Scope permissions must be carefully managed

## **Definition of Done**
- [ ] Google Workspace provider fully implemented
- [ ] Service account authentication working
- [ ] Domain-wide delegation functioning
- [ ] Email sending functionality working
- [ ] Rate limiting and error handling implemented
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Ensure proper handling of service account private keys
- Plan for Google Workspace admin approval process
- Monitor Google API changes and deprecations
- Consider implementing Gmail push notifications for delivery events

## **Related Tickets**
- TICKET-005: Base Email Provider (prerequisite)
- TICKET-006: Email Provider Factory (prerequisite)
- TICKET-011: Microsoft Graph Provider Implementation
- TICKET-013: Provider Integration Testing