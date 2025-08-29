# TICKET-011: Microsoft Graph Provider Implementation

## **Priority:** Medium
## **Estimated Time:** 4-5 days
## **Phase:** 4 - Implement Specific Email Providers
## **Dependencies:** TICKET-005, TICKET-006

---

## **Description**
Implement Microsoft Graph API email provider for Microsoft 365 integration. This provider will use the Microsoft Graph API to send emails through customer's Microsoft 365 accounts, supporting both delegated and application permissions.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `MicrosoftGraphProvider` class extending `BaseEmailProvider`
- [ ] Support application permissions (client credentials flow)
- [ ] Implement email sending via Graph API
- [ ] Support OAuth2 token management and refresh
- [ ] Include comprehensive error handling for Graph API errors
- [ ] Support tenant-specific authentication

### **Should Have**
- [ ] Support delegated permissions (on-behalf-of flow)
- [ ] Implement connection testing via Graph API
- [ ] Support Microsoft 365 rate limiting
- [ ] Include message tracking capabilities

### **Could Have**
- [ ] Support for Microsoft Graph webhooks
- [ ] Integration with Microsoft calendar for meeting requests
- [ ] Support for Microsoft Teams notifications

## **Technical Requirements**

### **Dependencies**
```json
{
  "dependencies": {
    "@azure/identity": "^4.0.1",
    "@microsoft/microsoft-graph-client": "^3.0.7"
  }
}
```

### **File Location**
```
server/src/libs/email/providers/MicrosoftGraphProvider.ts
```

### **Core Implementation**

```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential, OnBehalfOfCredential } from '@azure/identity';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
} from './EmailProvider.interface';
import type { MicrosoftGraphConfig } from '../types/EmailConfig.types';
import { EmailProviderError, EMAIL_ERROR_CODES } from '../types/EmailErrors.types';

export class MicrosoftGraphProvider extends BaseEmailProvider {
  private graphClient: Client | null = null;
  private credential: ClientSecretCredential | OnBehalfOfCredential | null = null;
  private tokenCache: Map<string, { token: string; expiresAt: Date }> = new Map();
  
  constructor(private msConfig: MicrosoftGraphConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: false, // Graph API doesn't provide sender validation
      supportsEmailValidation: false,  // Graph API doesn't provide email validation
      supportsWebhooks: true,          // Microsoft Graph supports webhooks
      supportsTemplating: false,       // Basic Graph API doesn't support templating
      maxRecipientsPerEmail: 500,      // Microsoft Graph limit
      maxEmailSizeBytes: 25 * 1024 * 1024, // 25MB limit
      rateLimits: {
        requestsPerSecond: 4,    // Conservative limit for Graph API
        requestsPerMinute: 240,  // ~4 requests per second
        requestsPerHour: 14400,  // Graph API throttling limits
      },
      supportedAuthMethods: ['oauth2', 'client_credentials'],
      supportedContentTypes: ['text/plain', 'text/html'],
      supportsBulkOperations: false, // Send individual emails
    };
    
    super(msConfig, capabilities, 'microsoft_graph');
  }
  
  async initialize(): Promise<void> {
    this.logOperation('initialize_start', {
      tenantId: this.msConfig.tenantId,
      clientId: this.msConfig.clientId,
      authType: this.msConfig.authType,
    });
    
    try {
      // Initialize authentication credential
      if (this.msConfig.authType === 'client_credentials') {
        this.credential = new ClientSecretCredential(
          this.msConfig.tenantId,
          this.msConfig.clientId,
          this.msConfig.clientSecret!
        );
      } else if (this.msConfig.authType === 'delegated') {
        // For delegated permissions, we would need user tokens
        throw new EmailProviderError(
          'Delegated authentication not yet implemented',
          EMAIL_ERROR_CODES.INVALID_CONFIG,
          400,
          this.providerType
        );
      }
      
      // Initialize Graph client
      this.graphClient = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async (scopes) => {
            return this.getAccessToken(scopes || this.msConfig.scopes);
          }
        }
      });
      
      // Test the connection
      await this.testConnection();
      
      this.logOperation('initialize_success', {
        tenantId: this.msConfig.tenantId,
        clientId: this.msConfig.clientId,
      });
    } catch (error) {
      this.logError('initialize', error);
      throw this.handleProviderError(error, 'initialize');
    }
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    // Ensure Graph client is initialized
    if (!this.graphClient) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      
      // Build Graph API message
      const message = this.buildGraphMessage(request);
      
      this.logOperation('sendEmail_start', {
        to: Array.isArray(request.to) ? request.to.length : 1,
        from: request.from.email,
        subject: request.subject,
        hasHtml: !!request.html,
        hasText: !!request.text,
      });
      
      // Send email via Microsoft Graph
      const response = await this.graphClient!
        .api('/me/sendMail')
        .post({ message });
      
      const duration = Date.now() - startTime;
      
      // Graph API sendMail doesn't return a message ID in the response
      // We'll generate one based on the timestamp and request
      const messageId = this.generateMessageId(request);
      
      const result: EmailSendResult = {
        success: true,
        messageId,
        providerMessageId: messageId,
        metadata: {
          graphResponse: response,
          duration,
          apiVersion: 'v1.0',
        }
      };
      
      this.logOperation('sendEmail_success', {
        messageId: result.messageId,
        duration,
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logError('sendEmail', error, { 
        request: this.sanitizeRequestForLogging(request),
        duration,
      });
      
      const mappedError = this.mapGraphError(error);
      
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
        tenantId: this.msConfig.tenantId,
        clientId: this.msConfig.clientId,
      });
      
      if (!this.graphClient) {
        await this.initialize();
      }
      
      // Test connection by getting user profile
      const profile = await this.graphClient!.api('/me').get();
      
      const duration = Date.now() - startTime;
      
      this.logOperation('testConnection_success', {
        userId: profile.id,
        userPrincipalName: profile.userPrincipalName,
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
      
      const mappedError = this.mapGraphError(error);
      
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
      this.graphClient = null;
      this.credential = null;
      
      this.logOperation('cleanup_success', {});
    } catch (error) {
      this.logError('cleanup', error);
    }
  }
  
  // Private helper methods
  
  private async getAccessToken(scopes: string[]): Promise<string> {
    const cacheKey = scopes.sort().join(',');
    
    // Check cache first
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.token;
    }
    
    if (!this.credential) {
      throw new EmailProviderError(
        'Authentication credential not initialized',
        EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        401,
        this.providerType
      );
    }
    
    try {
      const tokenResponse = await this.credential.getToken(scopes);
      
      if (!tokenResponse?.token) {
        throw new EmailProviderError(
          'Failed to acquire access token',
          EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
          401,
          this.providerType
        );
      }
      
      // Cache the token (with 5 minute buffer before expiry)
      const expiresAt = tokenResponse.expiresOnTimestamp 
        ? new Date(tokenResponse.expiresOnTimestamp - 5 * 60 * 1000)
        : new Date(Date.now() + 55 * 60 * 1000); // Default 55 minutes
      
      this.tokenCache.set(cacheKey, {
        token: tokenResponse.token,
        expiresAt,
      });
      
      return tokenResponse.token;
    } catch (error) {
      this.logError('getAccessToken', error, { scopes });
      throw this.handleProviderError(error, 'getAccessToken');
    }
  }
  
  private buildGraphMessage(request: EmailSendRequest): any {
    const message: any = {
      subject: request.subject,
      from: {
        emailAddress: {
          address: request.from.email,
          name: request.from.name || request.from.email,
        }
      },
      toRecipients: this.buildRecipients(request.to),
    };
    
    // Add body content
    if (request.html && request.text) {
      // Use HTML as primary content with text as fallback
      message.body = {
        contentType: 'HTML',
        content: request.html,
      };
      // Note: Graph API doesn't support multipart alternative
      // Text version would need to be handled differently if required
    } else if (request.html) {
      message.body = {
        contentType: 'HTML',
        content: request.html,
      };
    } else if (request.text) {
      message.body = {
        contentType: 'Text',
        content: request.text,
      };
    }
    
    // Add custom headers if supported
    if (request.headers) {
      // Note: Graph API has limited support for custom headers
      // Most custom headers are not supported
      message.internetMessageHeaders = Object.entries(request.headers)
        .filter(([key]) => this.isAllowedHeader(key))
        .map(([name, value]) => ({ name, value }));
    }
    
    // Add importance if specified in metadata
    if (request.metadata?.importance) {
      message.importance = request.metadata.importance;
    }
    
    return message;
  }
  
  private buildRecipients(to: string | string[]): any[] {
    const recipients = Array.isArray(to) ? to : [to];
    
    return recipients.map(email => ({
      emailAddress: {
        address: email.trim(),
      }
    }));
  }
  
  private isAllowedHeader(headerName: string): boolean {
    // Graph API only supports a limited set of custom headers
    const allowedHeaders = [
      'x-ms-exchange-messagesentrepresentingtype',
      'x-ms-exchange-organization-authsource',
      'x-ms-exchange-organization-authas',
    ];
    
    return allowedHeaders.some(allowed => 
      headerName.toLowerCase().startsWith(allowed.toLowerCase())
    );
  }
  
  private generateMessageId(request: EmailSendRequest): string {
    // Generate a unique message ID since Graph API doesn't return one
    const timestamp = Date.now();
    const hash = this.hashString(JSON.stringify({
      from: request.from.email,
      to: request.to,
      subject: request.subject,
      timestamp,
    }));
    
    return `graph-${timestamp}-${hash}`;
  }
  
  private hashString(str: string): string {
    // Simple hash function for message ID generation
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  private mapGraphError(error: any): { message: string; code: string; statusCode: number } {
    const graphError = error.response?.body?.error || error.error || error;
    const statusCode = error.status || error.statusCode || 500;
    
    // Authentication errors
    if (statusCode === 401 || graphError.code === 'InvalidAuthenticationToken') {
      return {
        message: 'Microsoft Graph authentication failed. Check client credentials.',
        code: EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        statusCode: 401,
      };
    }
    
    if (statusCode === 403 || graphError.code === 'Forbidden') {
      return {
        message: 'Insufficient permissions for Microsoft Graph API. Check application permissions.',
        code: EMAIL_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        statusCode: 403,
      };
    }
    
    // Rate limiting
    if (statusCode === 429 || graphError.code === 'TooManyRequests') {
      return {
        message: 'Microsoft Graph API rate limit exceeded',
        code: EMAIL_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      };
    }
    
    // Request validation errors
    if (statusCode === 400 || graphError.code === 'BadRequest') {
      const message = graphError.message || 'Invalid request to Microsoft Graph API';
      return {
        message: `Microsoft Graph validation error: ${message}`,
        code: EMAIL_ERROR_CODES.INVALID_CONFIG,
        statusCode: 400,
      };
    }
    
    // Server errors
    if (statusCode >= 500) {
      return {
        message: 'Microsoft Graph API service unavailable',
        code: EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
        statusCode,
      };
    }
    
    // Unknown error
    return {
      message: graphError.message || error.message || 'Unknown Microsoft Graph error',
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

## **Microsoft Graph Configuration**

### **Required Azure AD App Registration**
1. **Application Registration:**
   - Register application in Azure AD
   - Configure API permissions for Microsoft Graph
   - Generate client secret

2. **API Permissions Required:**
   ```
   Application Permissions:
   - Mail.Send (to send mail as any user)
   - User.Read.All (to read user profiles)
   
   Delegated Permissions:
   - Mail.Send (to send mail on behalf of signed-in user)
   - User.Read (to read signed-in user's profile)
   ```

3. **Admin Consent:**
   - Application permissions require admin consent
   - Tenant administrator must grant consent

### **Configuration Helper**
**File:** `server/src/libs/email/providers/MicrosoftGraphHelper.ts`

```typescript
export class MicrosoftGraphHelper {
  /**
   * Validate Microsoft Graph configuration
   */
  static validateConfig(config: MicrosoftGraphConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.tenantId) {
      errors.push('Microsoft tenant ID is required');
    }
    
    if (!config.clientId) {
      errors.push('Microsoft client ID is required');
    }
    
    if (config.authType === 'client_credentials' && !config.clientSecret) {
      errors.push('Client secret is required for application authentication');
    }
    
    if (!config.scopes || config.scopes.length === 0) {
      errors.push('At least one scope is required');
    }
    
    // Validate required scopes
    const requiredScopes = ['https://graph.microsoft.com/Mail.Send'];
    const hasRequiredScopes = requiredScopes.every(scope => 
      config.scopes.some(configScope => configScope.includes('Mail.Send'))
    );
    
    if (!hasRequiredScopes) {
      errors.push('Mail.Send scope is required');
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
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read',
    ];
  }
  
  /**
   * Build authority URL for custom tenants
   */
  static buildAuthorityUrl(tenantId: string): string {
    return `https://login.microsoftonline.com/${tenantId}`;
  }
}
```

## **Testing Requirements**

### **Unit Tests**
- [ ] Test Graph API message building
- [ ] Test error handling and mapping
- [ ] Test token caching and refresh
- [ ] Test connection validation

### **Integration Tests**
- [ ] Test with real Microsoft Graph API (dev tenant)
- [ ] Test authentication with client credentials
- [ ] Test email sending functionality
- [ ] Test rate limiting handling

### **Test Files**
```
server/src/libs/email/providers/__tests__/MicrosoftGraphProvider.test.ts
server/src/libs/email/providers/__tests__/MicrosoftGraphProvider.integration.test.ts
server/src/libs/email/providers/__tests__/MicrosoftGraphHelper.test.ts
```

### **Mock Microsoft Graph for Testing**
```typescript
// Mock Microsoft Graph client
jest.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    initWithMiddleware: jest.fn(() => ({
      api: jest.fn(() => ({
        get: jest.fn(),
        post: jest.fn(),
      })),
    })),
  },
}));

// Mock Azure Identity
jest.mock('@azure/identity', () => ({
  ClientSecretCredential: jest.fn(),
}));
```

## **Rate Limiting and Throttling**

### **Microsoft Graph Limits**
- **Mail API**: ~4 requests per second per user
- **Burst capacity**: Up to 10 requests per second for short periods
- **Daily limits**: Depend on license type

### **Throttling Handling**
- [ ] Implement exponential backoff for 429 responses
- [ ] Respect Retry-After headers
- [ ] Queue requests during rate limit periods
- [ ] Monitor and log throttling events

## **Security Considerations**
- [ ] Secure client secret storage
- [ ] Token caching with proper expiration
- [ ] Audit logging for Graph API calls
- [ ] Principle of least privilege for permissions
- [ ] Tenant isolation for multi-tenant scenarios

## **Monitoring and Observability**
- [ ] Log all Graph API interactions
- [ ] Monitor token refresh events
- [ ] Track rate limiting occurrences
- [ ] Measure API latency and success rates

## **Documentation Requirements**
- [ ] Document Azure AD app registration process
- [ ] Include permission configuration guide
- [ ] Document tenant administrator consent process
- [ ] Provide troubleshooting guide for common issues

## **Limitations and Considerations**

### **Microsoft Graph API Limitations**
- No support for traditional email headers
- Limited multipart message support
- Requires Azure AD app registration
- Subject to Microsoft's rate limiting

### **Authentication Considerations**
- Application permissions require admin consent
- Token caching required for performance
- Tenant-specific authentication
- Certificate-based authentication not implemented

## **Definition of Done**
- [ ] Microsoft Graph provider fully implemented
- [ ] Authentication and token management working
- [ ] Email sending functionality working
- [ ] Rate limiting and error handling implemented
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Consider implementing certificate-based authentication as alternative to client secret
- Plan for multi-tenant scenarios with different Azure AD tenants
- Monitor Microsoft Graph API changes and deprecations
- Consider implementing Graph webhooks for delivery notifications

## **Related Tickets**
- TICKET-005: Base Email Provider (prerequisite)
- TICKET-006: Email Provider Factory (prerequisite)
- TICKET-010: SMTP Provider Implementation
- TICKET-012: Google Workspace Provider Implementation