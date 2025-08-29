# TICKET-010: SMTP Provider Implementation

## **Priority:** High
## **Estimated Time:** 3-4 days
## **Phase:** 4 - Implement Specific Email Providers
## **Dependencies:** TICKET-005, TICKET-006

---

## **Description**
Implement a generic SMTP email provider that can connect to any SMTP server (Office 365, Gmail, custom mail servers, etc.). This provider will use Nodemailer for SMTP communication and support both basic authentication and OAuth2.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `SMTPProvider` class extending `BaseEmailProvider`
- [ ] Support basic SMTP authentication (username/password)
- [ ] Support TLS/SSL connections
- [ ] Implement connection pooling for performance
- [ ] Include comprehensive error handling
- [ ] Support common SMTP servers (Office 365, Gmail, etc.)

### **Should Have**
- [ ] Support OAuth2 authentication for modern providers
- [ ] Implement connection testing and validation
- [ ] Support SMTP server autodiscovery
- [ ] Include retry logic for transient failures

### **Could Have**
- [ ] Support SMTP server load balancing
- [ ] Implement connection health monitoring
- [ ] Support SMTP extensions (STARTTLS, etc.)

## **Technical Requirements**

### **Dependencies**
```json
{
  "dependencies": {
    "nodemailer": "^6.9.8"
  },
  "devDependencies": {
    "@types/nodemailer": "^6.4.14"
  }
}
```

### **File Location**
```
server/src/libs/email/providers/SMTPProvider.ts
```

### **Core Implementation**

```typescript
import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
} from './EmailProvider.interface';
import type { SMTPConfig } from '../types/EmailConfig.types';
import { EmailProviderError, EMAIL_ERROR_CODES } from '../types/EmailErrors.types';

export class SMTPProvider extends BaseEmailProvider {
  private transporter: Transporter | null = null;
  private connectionPool: Map<string, Transporter> = new Map();
  private lastConnectionTest: Date | null = null;
  private connectionTestInterval = 5 * 60 * 1000; // 5 minutes
  
  constructor(private smtpConfig: SMTPConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: false, // SMTP doesn't provide sender validation
      supportsEmailValidation: false,  // SMTP doesn't provide email validation
      supportsWebhooks: false,         // SMTP doesn't support webhooks
      supportsTemplating: false,       // Basic SMTP doesn't support templating
      maxRecipientsPerEmail: 50,       // Conservative default for SMTP
      maxEmailSizeBytes: 25 * 1024 * 1024, // 25MB default
      rateLimits: {
        // These depend on the SMTP server configuration
        requestsPerSecond: 5,
        requestsPerMinute: 300,
        requestsPerHour: 18000,
      },
      supportedAuthMethods: ['basic_auth', 'oauth2'],
      supportedContentTypes: ['text/plain', 'text/html'],
      supportsBulkOperations: false, // Depends on server configuration
    };
    
    super(smtpConfig, capabilities, 'smtp');
  }
  
  async initialize(): Promise<void> {
    this.logOperation('initialize_start', {
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      authType: this.smtpConfig.auth.type,
    });
    
    try {
      this.transporter = await this.createTransporter();
      
      // Test the connection
      await this.transporter.verify();
      
      this.logOperation('initialize_success', {
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
      });
    } catch (error) {
      this.logError('initialize', error);
      throw this.handleProviderError(error, 'initialize');
    }
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    // Ensure transporter is initialized
    if (!this.transporter) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      
      // Build mail options
      const mailOptions = this.buildMailOptions(request);
      
      this.logOperation('sendEmail_start', {
        to: Array.isArray(request.to) ? request.to.length : 1,
        from: request.from.email,
        subject: request.subject,
        hasHtml: !!request.html,
        hasText: !!request.text,
      });
      
      // Send email via SMTP
      const info = await this.transporter!.sendMail(mailOptions);
      
      const duration = Date.now() - startTime;
      
      const result: EmailSendResult = {
        success: true,
        messageId: info.messageId,
        providerMessageId: info.messageId,
        metadata: {
          response: info.response,
          envelope: info.envelope,
          accepted: info.accepted,
          rejected: info.rejected,
          pending: info.pending,
          duration,
        }
      };
      
      this.logOperation('sendEmail_success', {
        messageId: result.messageId,
        accepted: info.accepted?.length || 0,
        rejected: info.rejected?.length || 0,
        duration,
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logError('sendEmail', error, { 
        request: this.sanitizeRequestForLogging(request),
        duration,
      });
      
      const mappedError = this.mapSMTPError(error);
      
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
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
      });
      
      // Create a test transporter if none exists
      const testTransporter = this.transporter || await this.createTransporter();
      
      // Verify SMTP connection
      const isConnected = await testTransporter.verify();
      
      const duration = Date.now() - startTime;
      
      if (isConnected) {
        this.lastConnectionTest = new Date();
        
        this.logOperation('testConnection_success', {
          host: this.smtpConfig.host,
          port: this.smtpConfig.port,
          duration,
        });
        
        return {
          success: true,
          latencyMs: duration,
          capabilities: this.capabilities,
        };
      } else {
        this.logError('testConnection', new Error('SMTP verification failed'), { duration });
        
        return {
          success: false,
          error: 'SMTP server verification failed',
          latencyMs: duration,
        };
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.logError('testConnection', error, { duration });
      
      const mappedError = this.mapSMTPError(error);
      
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
      if (this.transporter) {
        this.transporter.close();
        this.transporter = null;
      }
      
      // Close all pooled connections
      for (const [key, transporter] of this.connectionPool) {
        transporter.close();
      }
      this.connectionPool.clear();
      
      this.logOperation('cleanup_success', {});
    } catch (error) {
      this.logError('cleanup', error);
    }
  }
  
  // Private helper methods
  
  private async createTransporter(): Promise<Transporter> {
    const config = this.smtpConfig;
    
    const transporterOptions: any = {
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465, false for other ports
      
      // Connection pooling for performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      
      // Timeouts
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 600000,    // 10 minutes
      
      // TLS options
      tls: {
        rejectUnauthorized: config.tls?.rejectUnauthorized ?? true,
        ciphers: config.tls?.ciphers,
      },
    };
    
    // Add authentication
    if (config.auth.type === 'login') {
      transporterOptions.auth = {
        user: config.auth.user,
        pass: config.auth.pass,
      };
    } else if (config.auth.type === 'oauth2') {
      transporterOptions.auth = {
        type: 'OAuth2',
        user: config.auth.user,
        accessToken: config.auth.accessToken,
        refreshToken: config.auth.refreshToken,
      };
    }
    
    return nodemailer.createTransporter(transporterOptions);
  }
  
  private buildMailOptions(request: EmailSendRequest): SendMailOptions {
    const options: SendMailOptions = {
      from: this.formatEmailAddress(request.from.email, request.from.name),
      to: this.formatRecipients(request.to),
      subject: request.subject,
      headers: request.headers,
    };
    
    // Add content
    if (request.html) {
      options.html = request.html;
    }
    if (request.text) {
      options.text = request.text;
    }
    
    // Add metadata as custom headers (with X- prefix)
    if (request.metadata) {
      options.headers = {
        ...options.headers,
        ...this.buildCustomHeaders(request.metadata),
      };
    }
    
    return options;
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
  
  private formatRecipients(to: string | string[]): string {
    if (Array.isArray(to)) {
      return to.join(', ');
    }
    return to;
  }
  
  private buildCustomHeaders(metadata: Record<string, any>): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Add metadata as custom headers with X- prefix
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        const headerName = key.startsWith('X-') ? key : `X-${key}`;
        headers[headerName] = String(value);
      }
    }
    
    return headers;
  }
  
  private mapSMTPError(error: any): { message: string; code: string; statusCode: number } {
    const errorCode = error.code || '';
    const errorMessage = error.message || '';
    
    // Authentication errors
    if (errorCode === 'EAUTH' || errorMessage.includes('authentication failed')) {
      return {
        message: 'SMTP authentication failed. Check username and password.',
        code: EMAIL_ERROR_CODES.INVALID_CREDENTIALS,
        statusCode: 401,
      };
    }
    
    // Connection errors
    if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED') {
      return {
        message: `Cannot connect to SMTP server ${this.smtpConfig.host}:${this.smtpConfig.port}`,
        code: EMAIL_ERROR_CODES.CONNECTION_FAILED,
        statusCode: 503,
      };
    }
    
    if (errorCode === 'ETIMEDOUT' || errorCode === 'ESOCKET') {
      return {
        message: 'SMTP connection timeout. Server may be overloaded.',
        code: EMAIL_ERROR_CODES.CONNECTION_FAILED,
        statusCode: 504,
      };
    }
    
    // TLS/SSL errors
    if (errorCode === 'CERT_HAS_EXPIRED' || errorCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return {
        message: 'SMTP server SSL certificate verification failed',
        code: EMAIL_ERROR_CODES.CONNECTION_FAILED,
        statusCode: 495,
      };
    }
    
    // Rate limiting (some SMTP servers return specific codes)
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota exceeded')) {
      return {
        message: 'SMTP server rate limit exceeded',
        code: EMAIL_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        statusCode: 429,
      };
    }
    
    // Invalid recipient errors
    if (errorCode === 'EENVELOPE' || errorMessage.includes('recipient rejected')) {
      return {
        message: 'Invalid or rejected recipient email address',
        code: EMAIL_ERROR_CODES.INVALID_RECIPIENT,
        statusCode: 400,
      };
    }
    
    // Message too large
    if (errorMessage.includes('message too large') || errorMessage.includes('size limit')) {
      return {
        message: 'Email message exceeds server size limit',
        code: EMAIL_ERROR_CODES.MESSAGE_TOO_LARGE,
        statusCode: 413,
      };
    }
    
    // Generic server errors
    if (errorCode.startsWith('E') && errorCode !== 'EAUTH') {
      return {
        message: `SMTP server error: ${errorMessage}`,
        code: EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE,
        statusCode: 503,
      };
    }
    
    // Unknown error
    return {
      message: errorMessage || 'Unknown SMTP error',
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
      metadataKeys: request.metadata ? Object.keys(request.metadata) : [],
    };
  }
  
  // Health monitoring
  private shouldTestConnection(): boolean {
    if (!this.lastConnectionTest) {
      return true;
    }
    
    const timeSinceLastTest = Date.now() - this.lastConnectionTest.getTime();
    return timeSinceLastTest > this.connectionTestInterval;
  }
  
  private async ensureHealthyConnection(): Promise<void> {
    if (this.shouldTestConnection()) {
      const testResult = await this.testConnection();
      if (!testResult.success) {
        // Recreate transporter if connection test fails
        if (this.transporter) {
          this.transporter.close();
          this.transporter = null;
        }
        await this.initialize();
      }
    }
  }
}
```

## **SMTP Server Presets**

### **Common SMTP Server Configurations**
**File:** `server/src/libs/email/providers/SMTPPresets.ts`

```typescript
export interface SMTPPreset {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  authType: 'login' | 'oauth2';
  description: string;
  documentation?: string;
}

export const SMTP_PRESETS: Record<string, SMTPPreset> = {
  'office365': {
    name: 'Microsoft Office 365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // Use STARTTLS
    authType: 'login',
    description: 'Microsoft Office 365 SMTP',
    documentation: 'https://docs.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365',
  },
  'gmail': {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    authType: 'oauth2', // Prefer OAuth2 for Gmail
    description: 'Gmail SMTP',
    documentation: 'https://developers.google.com/gmail/smtp/smtp-auth',
  },
  'outlook': {
    name: 'Outlook.com',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    authType: 'login',
    description: 'Outlook.com SMTP',
  },
  'yahoo': {
    name: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    authType: 'login',
    description: 'Yahoo Mail SMTP',
  },
  'custom': {
    name: 'Custom SMTP Server',
    host: '',
    port: 587,
    secure: false,
    authType: 'login',
    description: 'Custom SMTP server configuration',
  },
};

export function getSMTPPreset(presetName: string): SMTPPreset | undefined {
  return SMTP_PRESETS[presetName];
}

export function getAllSMTPPresets(): SMTPPreset[] {
  return Object.values(SMTP_PRESETS);
}
```

## **OAuth2 Integration**

### **OAuth2 Helper for Gmail/Office365**
**File:** `server/src/libs/email/providers/SMTPOAuth2Helper.ts`

```typescript
export class SMTPOAuth2Helper {
  /**
   * Refresh OAuth2 access token
   */
  static async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    provider: 'gmail' | 'office365'
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    // Implementation for OAuth2 token refresh
    // This would integrate with Google/Microsoft OAuth2 APIs
    throw new Error('OAuth2 refresh not implemented');
  }
  
  /**
   * Validate OAuth2 configuration
   */
  static validateOAuth2Config(config: any): boolean {
    return !!(config.accessToken && config.refreshToken);
  }
}
```

## **Testing Requirements**

### **Unit Tests**
- [ ] Test SMTP connection with various server configurations
- [ ] Test email sending with different content types
- [ ] Test error handling for common SMTP errors
- [ ] Test OAuth2 authentication
- [ ] Test connection pooling and cleanup

### **Integration Tests**
- [ ] Test with real SMTP servers (using test accounts)
- [ ] Test with Office 365 and Gmail
- [ ] Test connection recovery after failures
- [ ] Test performance with connection pooling

### **Test Files**
```
server/src/libs/email/providers/__tests__/SMTPProvider.test.ts
server/src/libs/email/providers/__tests__/SMTPProvider.integration.test.ts
server/src/libs/email/providers/__tests__/SMTPPresets.test.ts
```

### **Mock SMTP Server for Testing**
```typescript
// Use smtp-server for integration testing
import { SMTPServer } from 'smtp-server';

const testSMTPServer = new SMTPServer({
  authRequired: true,
  onAuth: (auth, session, callback) => {
    if (auth.username === 'test' && auth.password === 'test') {
      return callback(null, { user: 'test' });
    }
    return callback(new Error('Invalid credentials'));
  },
  onData: (stream, session, callback) => {
    // Capture email data for testing
    callback(null, 'Message accepted');
  },
});
```

## **Performance Optimization**

### **Connection Pooling**
- [ ] Implement connection pooling for high-volume sending
- [ ] Configure appropriate pool sizes
- [ ] Handle connection cleanup properly
- [ ] Monitor pool health

### **Error Recovery**
- [ ] Implement exponential backoff for retries
- [ ] Handle temporary connection failures
- [ ] Reconnect on connection drops
- [ ] Circuit breaker pattern for persistent failures

## **Security Considerations**
- [ ] Secure credential storage and handling
- [ ] TLS/SSL certificate validation
- [ ] Support for STARTTLS
- [ ] OAuth2 token management
- [ ] Rate limiting to prevent abuse

## **Documentation Requirements**
- [ ] Document SMTP server configuration
- [ ] Include setup guides for common providers
- [ ] Document OAuth2 setup process
- [ ] Provide troubleshooting guide for common issues

## **Definition of Done**
- [ ] SMTP provider fully implemented
- [ ] Support for major SMTP providers working
- [ ] OAuth2 authentication implemented
- [ ] Connection pooling and error recovery working
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Consider rate limits of different SMTP providers
- Plan for OAuth2 token refresh logic
- Ensure proper connection cleanup to prevent resource leaks
- Test with various SMTP server configurations

## **Related Tickets**
- TICKET-005: Base Email Provider (prerequisite)
- TICKET-006: Email Provider Factory (prerequisite)
- TICKET-009: SendGrid Provider Implementation
- TICKET-011: Microsoft Graph Provider Implementation