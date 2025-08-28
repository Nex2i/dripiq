# **Email Provider Abstraction Implementation Plan**

## **Overview**
This plan outlines the complete refactoring needed to support direct email delivery via customer mail servers (SMTP, Microsoft 365, Google Workspace API) instead of relying solely on SendGrid.

## **Current State Analysis**

### **Tightly Coupled SendGrid Components:**
- `sendgrid.client.ts` - Direct SendGrid API integration
- `EmailProcessor.ts` - Hardcoded SendGrid usage
- `senderIdentity.service.ts` - SendGrid-specific validation
- `sendgrid.webhook.service.ts` - SendGrid webhook processing
- Database schema with `sendgridSenderId` field

### **Key Dependencies to Abstract:**
- `@sendgrid/mail` and `@sendgrid/client` packages
- SendGrid-specific webhook validation
- SendGrid API error handling
- SendGrid sender verification flow

---

## **Phase 1: Foundation - Core Interfaces and Types**
*Estimated: 3-5 days*

### **1.1 Create Type Definitions**

**File: `server/src/libs/email/types/EmailProvider.types.ts`**
```typescript
export type EmailProviderType = 'sendgrid' | 'smtp' | 'microsoft_graph' | 'google_workspace';
export type AuthType = 'api_key' | 'oauth2' | 'basic_auth' | 'service_account';

export interface EmailSendRequest {
  from: { email: string; name?: string };
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
  categories?: string[];
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  providerMessageId?: string;
  error?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}

export interface EmailProviderCapabilities {
  supportsSenderValidation: boolean;
  supportsEmailValidation: boolean;
  supportsWebhooks: boolean;
  supportsTemplating: boolean;
  maxRecipientsPerEmail: number;
  rateLimits?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  latencyMs?: number;
  capabilities?: EmailProviderCapabilities;
}
```

**File: `server/src/libs/email/types/EmailConfig.types.ts`**
```typescript
export interface BaseProviderConfig {
  id?: string;
  tenantId: string;
  type: EmailProviderType;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SendGridConfig extends BaseProviderConfig {
  type: 'sendgrid';
  apiKey: string;
  webhookPublicKey?: string;
  ipPoolName?: string;
}

export interface SMTPConfig extends BaseProviderConfig {
  type: 'smtp';
  host: string;
  port: number;
  secure: boolean; // true for 465, false for 587
  auth: {
    type: 'login' | 'oauth2';
    user: string;
    pass?: string; // For basic auth
    accessToken?: string; // For OAuth2
    refreshToken?: string; // For OAuth2
  };
  tls?: {
    rejectUnauthorized: boolean;
    ciphers?: string;
  };
}

export interface MicrosoftGraphConfig extends BaseProviderConfig {
  type: 'microsoft_graph';
  tenantId: string;
  clientId: string;
  clientSecret?: string; // For app-only auth
  scopes: string[];
  authorityUrl?: string;
  authType: 'client_credentials' | 'delegated';
}

export interface GoogleWorkspaceConfig extends BaseProviderConfig {
  type: 'google_workspace';
  authType: 'service_account' | 'oauth2';
  projectId: string;
  clientEmail?: string; // For service account
  privateKey?: string; // For service account
  delegatedUser?: string; // For domain-wide delegation
  scopes: string[];
  clientId?: string; // For OAuth2
  clientSecret?: string; // For OAuth2
}

export type ProviderConfig = SendGridConfig | SMTPConfig | MicrosoftGraphConfig | GoogleWorkspaceConfig;
```

**File: `server/src/libs/email/types/EmailErrors.types.ts`**
```typescript
export class EmailProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly provider: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}

export const EMAIL_ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_CONFIG: 'MISSING_CONFIG',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  
  // Email sending errors
  INVALID_RECIPIENT: 'INVALID_RECIPIENT',
  INVALID_SENDER: 'INVALID_SENDER',
  MESSAGE_TOO_LARGE: 'MESSAGE_TOO_LARGE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Provider specific
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
} as const;
```

### **1.2 Create Provider Interface**

**File: `server/src/libs/email/providers/EmailProvider.interface.ts`**
```typescript
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  EmailProviderCapabilities,
  ConnectionTestResult,
  BaseProviderConfig 
} from '../types/EmailProvider.types';

export interface EmailProvider {
  readonly config: BaseProviderConfig;
  readonly capabilities: EmailProviderCapabilities;
  readonly providerType: string;
  
  // Core operations
  sendEmail(request: EmailSendRequest): Promise<EmailSendResult>;
  testConnection(): Promise<ConnectionTestResult>;
  
  // Optional operations
  validateEmail?(email: string): Promise<EmailValidationResult>;
  createSenderIdentity?(request: SenderIdentityRequest): Promise<SenderIdentityResult>;
  verifySenderIdentity?(request: SenderVerificationRequest): Promise<SenderVerificationResult>;
  
  // Lifecycle
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

export interface SenderIdentityRequest {
  email: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
}

export interface SenderIdentityResult {
  success: boolean;
  identityId?: string;
  verificationRequired?: boolean;
  verificationUrl?: string;
  error?: string;
}

export interface SenderVerificationRequest {
  identityId: string;
  verificationToken?: string;
  verificationUrl?: string;
}

export interface SenderVerificationResult {
  success: boolean;
  verified: boolean;
  error?: string;
}
```

---

## **Phase 2: Provider Factory and Base Implementation**
*Estimated: 4-6 days*

### **2.1 Create Provider Factory**

**File: `server/src/libs/email/EmailProviderFactory.ts`**
```typescript
import type { EmailProvider } from './providers/EmailProvider.interface';
import type { ProviderConfig, EmailProviderType } from './types/EmailConfig.types';
import { SendGridProvider } from './providers/SendGridProvider';
import { SMTPProvider } from './providers/SMTPProvider';
import { MicrosoftGraphProvider } from './providers/MicrosoftGraphProvider';
import { GoogleWorkspaceProvider } from './providers/GoogleWorkspaceProvider';
import { EmailProviderError, EMAIL_ERROR_CODES } from './types/EmailErrors.types';

export class EmailProviderFactory {
  private static providers = new Map<string, EmailProvider>();
  
  static async createProvider(config: ProviderConfig): Promise<EmailProvider> {
    const cacheKey = `${config.tenantId}-${config.id || config.name}`;
    
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }
    
    let provider: EmailProvider;
    
    switch (config.type) {
      case 'sendgrid':
        provider = new SendGridProvider(config);
        break;
      case 'smtp':
        provider = new SMTPProvider(config);
        break;
      case 'microsoft_graph':
        provider = new MicrosoftGraphProvider(config);
        break;
      case 'google_workspace':
        provider = new GoogleWorkspaceProvider(config);
        break;
      default:
        throw new EmailProviderError(
          `Unsupported provider type: ${(config as any).type}`,
          EMAIL_ERROR_CODES.PROVIDER_NOT_FOUND,
          400,
          'factory'
        );
    }
    
    if (provider.initialize) {
      await provider.initialize();
    }
    
    this.providers.set(cacheKey, provider);
    return provider;
  }
  
  static async getProviderForTenant(
    tenantId: string, 
    providerName?: string
  ): Promise<EmailProvider> {
    // Implementation will fetch from database
    const config = await this.getProviderConfig(tenantId, providerName);
    return this.createProvider(config);
  }
  
  static async getProviderForSenderIdentity(
    senderIdentityId: string,
    tenantId: string
  ): Promise<EmailProvider> {
    // Implementation will fetch sender identity and associated provider config
    const config = await this.getProviderConfigForSender(senderIdentityId, tenantId);
    return this.createProvider(config);
  }
  
  private static async getProviderConfig(
    tenantId: string, 
    providerName?: string
  ): Promise<ProviderConfig> {
    // TODO: Implement database lookup
    throw new Error('Not implemented');
  }
  
  private static async getProviderConfigForSender(
    senderIdentityId: string,
    tenantId: string
  ): Promise<ProviderConfig> {
    // TODO: Implement database lookup
    throw new Error('Not implemented');
  }
  
  static clearCache(tenantId?: string): void {
    if (tenantId) {
      // Clear specific tenant providers
      for (const [key] of this.providers) {
        if (key.startsWith(`${tenantId}-`)) {
          this.providers.delete(key);
        }
      }
    } else {
      // Clear all providers
      this.providers.clear();
    }
  }
}
```

### **2.2 Create Base Provider Abstract Class**

**File: `server/src/libs/email/providers/BaseEmailProvider.ts`**
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
  
  abstract sendEmail(request: EmailSendRequest): Promise<EmailSendResult>;
  abstract testConnection(): Promise<ConnectionTestResult>;
  
  protected validateSendRequest(request: EmailSendRequest): void {
    if (!request.from?.email) {
      throw new EmailProviderError(
        'From email is required',
        EMAIL_ERROR_CODES.INVALID_SENDER,
        400,
        this.providerType
      );
    }
    
    if (!request.to) {
      throw new EmailProviderError(
        'To email is required',
        EMAIL_ERROR_CODES.INVALID_RECIPIENT,
        400,
        this.providerType
      );
    }
    
    if (!request.subject?.trim()) {
      throw new EmailProviderError(
        'Subject is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        this.providerType
      );
    }
    
    if (!request.html?.trim() && !request.text?.trim()) {
      throw new EmailProviderError(
        'Either HTML or text content is required',
        EMAIL_ERROR_CODES.INVALID_CONFIG,
        400,
        this.providerType
      );
    }
  }
  
  protected normalizeEmailAddress(email: string): string {
    return email.toLowerCase().trim();
  }
  
  protected logOperation(operation: string, data: any): void {
    this.logger.info(`[${this.providerType}] ${operation}`, {
      provider: this.providerType,
      tenantId: this.config.tenantId,
      configId: this.config.id,
      ...data
    });
  }
  
  protected logError(operation: string, error: any, data?: any): void {
    this.logger.error(`[${this.providerType}] ${operation} failed`, {
      provider: this.providerType,
      tenantId: this.config.tenantId,
      configId: this.config.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ...data
    });
  }
}
```

---

## **Phase 3: Database Schema Changes**
*Estimated: 2-3 days*

### **3.1 Create Provider Configuration Tables**

**File: `server/src/db/migrations/XXXX_add_email_provider_tables.sql`**
```sql
-- Email Provider Configurations (tenant-level)
CREATE TABLE IF NOT EXISTS "dripiq_app"."email_provider_configs" (
  "id" text PRIMARY KEY DEFAULT generate_cuid(),
  "tenant_id" text NOT NULL REFERENCES "dripiq_app"."tenants"("id") ON DELETE CASCADE,
  "type" text NOT NULL CHECK (type IN ('sendgrid', 'smtp', 'microsoft_graph', 'google_workspace')),
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "encrypted_credentials" text, -- Encrypted JSON string
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW(),
  UNIQUE("tenant_id", "name")
);

-- OAuth tokens for providers that require them
CREATE TABLE IF NOT EXISTS "dripiq_app"."email_provider_tokens" (
  "id" text PRIMARY KEY DEFAULT generate_cuid(),
  "config_id" text NOT NULL REFERENCES "dripiq_app"."email_provider_configs"("id") ON DELETE CASCADE,
  "encrypted_access_token" text,
  "encrypted_refresh_token" text,
  "token_type" text DEFAULT 'Bearer',
  "expires_at" timestamp,
  "scopes" text[],
  "created_at" timestamp NOT NULL DEFAULT NOW(),
  "updated_at" timestamp NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX "email_provider_configs_tenant_id_idx" ON "dripiq_app"."email_provider_configs"("tenant_id");
CREATE INDEX "email_provider_configs_tenant_id_is_default_idx" ON "dripiq_app"."email_provider_configs"("tenant_id", "is_default") WHERE "is_default" = true;
CREATE INDEX "email_provider_tokens_config_id_idx" ON "dripiq_app"."email_provider_tokens"("config_id");
```

### **3.2 Modify Email Sender Identities Table**

**File: `server/src/db/migrations/XXXX_update_email_sender_identities.sql`**
```sql
-- Add provider config reference to email sender identities
ALTER TABLE "dripiq_app"."email_sender_identities" 
ADD COLUMN "provider_config_id" text REFERENCES "dripiq_app"."email_provider_configs"("id") ON DELETE SET NULL;

-- Make sendgrid_sender_id nullable (legacy field)
ALTER TABLE "dripiq_app"."email_sender_identities" 
ALTER COLUMN "sendgrid_sender_id" DROP NOT NULL;

-- Add provider-specific validation data
ALTER TABLE "dripiq_app"."email_sender_identities" 
ADD COLUMN "provider_validation_data" jsonb;

-- Add index for provider config lookup
CREATE INDEX "email_sender_identities_provider_config_id_idx" 
ON "dripiq_app"."email_sender_identities"("provider_config_id");
```

### **3.3 Update Schema Types**

**File: `server/src/db/schema.ts` (additions)**
```typescript
// Email Provider Configurations
export const emailProviderConfigs = appSchema.table(
  'email_provider_configs',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'sendgrid' | 'smtp' | 'microsoft_graph' | 'google_workspace'
    name: text('name').notNull(),
    config: jsonb('config').notNull(),
    encryptedCredentials: text('encrypted_credentials'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('tenant_provider_name_unique').on(table.tenantId, table.name)]
);

// OAuth tokens for email providers
export const emailProviderTokens = appSchema.table('email_provider_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  configId: text('config_id')
    .notNull()
    .references(() => emailProviderConfigs.id, { onDelete: 'cascade' }),
  encryptedAccessToken: text('encrypted_access_token'),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  tokenType: text('token_type').default('Bearer'),
  expiresAt: timestamp('expires_at'),
  scopes: text('scopes').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Update existing emailSenderIdentities table
export const emailSenderIdentities = appSchema.table(
  'email_sender_identities',
  {
    // ... existing fields ...
    providerConfigId: text('provider_config_id').references(() => emailProviderConfigs.id, {
      onDelete: 'set null'
    }),
    providerValidationData: jsonb('provider_validation_data'),
    // sendgridSenderId is now nullable
  }
);

// Relations
export const emailProviderConfigsRelations = relations(emailProviderConfigs, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [emailProviderConfigs.tenantId],
    references: [tenants.id],
  }),
  tokens: many(emailProviderTokens),
  senderIdentities: many(emailSenderIdentities),
}));

export const emailProviderTokensRelations = relations(emailProviderTokens, ({ one }) => ({
  config: one(emailProviderConfigs, {
    fields: [emailProviderTokens.configId],
    references: [emailProviderConfigs.id],
  }),
}));

// Types
export type EmailProviderConfig = typeof emailProviderConfigs.$inferSelect;
export type NewEmailProviderConfig = typeof emailProviderConfigs.$inferInsert;
export type EmailProviderToken = typeof emailProviderTokens.$inferSelect;
export type NewEmailProviderToken = typeof emailProviderTokens.$inferInsert;
```

---

## **Phase 4: Implement Specific Email Providers**
*Estimated: 8-12 days*

### **4.1 SendGrid Provider (Wrapper)**

**File: `server/src/libs/email/providers/SendGridProvider.ts`**
```typescript
import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
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
      rateLimits: {
        requestsPerSecond: 10,
      }
    };
    
    super(config, capabilities, 'sendgrid');
    
    this.sgMail.setApiKey(config.apiKey);
    this.sgClient.setApiKey(config.apiKey);
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    try {
      const msg = {
        from: request.from,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
        headers: request.headers,
        categories: request.categories,
        customArgs: request.metadata,
      };
      
      const [response] = await this.sgMail.send(msg);
      
      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
        providerMessageId: response.headers['x-message-id'] as string,
        statusCode: response.statusCode,
        metadata: {
          headers: response.headers,
          body: response.body,
        }
      };
    } catch (error: any) {
      this.logError('sendEmail', error, { request });
      
      return {
        success: false,
        error: error.message || 'Failed to send email',
        statusCode: error.code || 500,
        metadata: {
          originalError: error,
        }
      };
    }
  }
  
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const startTime = Date.now();
      
      // Test API key by making a simple API call
      const request = {
        url: '/v3/user/profile',
        method: 'GET' as const,
      };
      
      await this.sgClient.request(request);
      
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        capabilities: this.capabilities,
      };
    } catch (error: any) {
      this.logError('testConnection', error);
      
      return {
        success: false,
        error: error.message || 'Connection test failed',
      };
    }
  }
}
```

### **4.2 SMTP Provider**

**File: `server/src/libs/email/providers/SMTPProvider.ts`**
```typescript
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
} from './EmailProvider.interface';
import type { SMTPConfig } from '../types/EmailConfig.types';

export class SMTPProvider extends BaseEmailProvider {
  private transporter: Transporter | null = null;
  
  constructor(private smtpConfig: SMTPConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: false,
      supportsEmailValidation: false,
      supportsWebhooks: false,
      supportsTemplating: false,
      maxRecipientsPerEmail: 50, // Conservative default
    };
    
    super(smtpConfig, capabilities, 'smtp');
  }
  
  async initialize(): Promise<void> {
    this.transporter = nodemailer.createTransporter({
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      auth: {
        user: this.smtpConfig.auth.user,
        pass: this.smtpConfig.auth.pass,
      },
      tls: this.smtpConfig.tls,
    });
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    if (!this.transporter) {
      await this.initialize();
    }
    
    try {
      const mailOptions = {
        from: `${request.from.name || ''} <${request.from.email}>`,
        to: Array.isArray(request.to) ? request.to.join(', ') : request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
        headers: request.headers,
      };
      
      const info = await this.transporter!.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        providerMessageId: info.messageId,
        metadata: {
          response: info.response,
          envelope: info.envelope,
        }
      };
    } catch (error: any) {
      this.logError('sendEmail', error, { request });
      
      return {
        success: false,
        error: error.message || 'Failed to send email via SMTP',
        metadata: {
          originalError: error,
        }
      };
    }
  }
  
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.transporter) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      await this.transporter!.verify();
      
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        capabilities: this.capabilities,
      };
    } catch (error: any) {
      this.logError('testConnection', error);
      
      return {
        success: false,
        error: error.message || 'SMTP connection test failed',
      };
    }
  }
  
  async cleanup(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
```

### **4.3 Microsoft Graph Provider**

**File: `server/src/libs/email/providers/MicrosoftGraphProvider.ts`**
```typescript
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
} from './EmailProvider.interface';
import type { MicrosoftGraphConfig } from '../types/EmailConfig.types';

export class MicrosoftGraphProvider extends BaseEmailProvider {
  private graphClient: Client | null = null;
  
  constructor(private msConfig: MicrosoftGraphConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: false,
      supportsEmailValidation: false,
      supportsWebhooks: true,
      supportsTemplating: false,
      maxRecipientsPerEmail: 500,
      rateLimits: {
        requestsPerSecond: 4,
        requestsPerMinute: 240,
      }
    };
    
    super(msConfig, capabilities, 'microsoft_graph');
  }
  
  async initialize(): Promise<void> {
    const credential = new ClientSecretCredential(
      this.msConfig.tenantId,
      this.msConfig.clientId,
      this.msConfig.clientSecret!
    );
    
    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          const tokenResponse = await credential.getToken(this.msConfig.scopes);
          return tokenResponse?.token || '';
        }
      }
    });
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    if (!this.graphClient) {
      await this.initialize();
    }
    
    try {
      const message = {
        subject: request.subject,
        body: {
          contentType: request.html ? 'HTML' : 'Text',
          content: request.html || request.text,
        },
        from: {
          emailAddress: {
            address: request.from.email,
            name: request.from.name,
          }
        },
        toRecipients: Array.isArray(request.to) 
          ? request.to.map(email => ({ emailAddress: { address: email } }))
          : [{ emailAddress: { address: request.to } }],
      };
      
      const response = await this.graphClient!
        .api('/me/sendMail')
        .post({ message });
      
      return {
        success: true,
        messageId: response.id || Date.now().toString(),
        providerMessageId: response.id,
        metadata: response,
      };
    } catch (error: any) {
      this.logError('sendEmail', error, { request });
      
      return {
        success: false,
        error: error.message || 'Failed to send email via Microsoft Graph',
        statusCode: error.status || 500,
        metadata: {
          originalError: error,
        }
      };
    }
  }
  
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.graphClient) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      await this.graphClient!.api('/me').get();
      
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        capabilities: this.capabilities,
      };
    } catch (error: any) {
      this.logError('testConnection', error);
      
      return {
        success: false,
        error: error.message || 'Microsoft Graph connection test failed',
      };
    }
  }
}
```

### **4.4 Google Workspace Provider**

**File: `server/src/libs/email/providers/GoogleWorkspaceProvider.ts`**
```typescript
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { BaseEmailProvider } from './BaseEmailProvider';
import type { 
  EmailSendRequest, 
  EmailSendResult, 
  ConnectionTestResult,
  EmailProviderCapabilities 
} from './EmailProvider.interface';
import type { GoogleWorkspaceConfig } from '../types/EmailConfig.types';

export class GoogleWorkspaceProvider extends BaseEmailProvider {
  private gmail: any = null;
  private auth: JWT | null = null;
  
  constructor(private googleConfig: GoogleWorkspaceConfig) {
    const capabilities: EmailProviderCapabilities = {
      supportsSenderValidation: false,
      supportsEmailValidation: false,
      supportsWebhooks: true,
      supportsTemplating: false,
      maxRecipientsPerEmail: 100,
      rateLimits: {
        requestsPerSecond: 5,
        requestsPerMinute: 250,
      }
    };
    
    super(googleConfig, capabilities, 'google_workspace');
  }
  
  async initialize(): Promise<void> {
    if (this.googleConfig.authType === 'service_account') {
      this.auth = new JWT({
        email: this.googleConfig.clientEmail,
        key: this.googleConfig.privateKey?.replace(/\\n/g, '\n'),
        scopes: this.googleConfig.scopes,
        subject: this.googleConfig.delegatedUser, // For domain-wide delegation
      });
      
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
    } else {
      throw new Error('OAuth2 authentication not yet implemented for Google Workspace');
    }
  }
  
  async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    this.validateSendRequest(request);
    
    if (!this.gmail) {
      await this.initialize();
    }
    
    try {
      const email = this.createRawEmail(request);
      
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(email).toString('base64url'),
        },
      });
      
      return {
        success: true,
        messageId: response.data.id,
        providerMessageId: response.data.id,
        metadata: response.data,
      };
    } catch (error: any) {
      this.logError('sendEmail', error, { request });
      
      return {
        success: false,
        error: error.message || 'Failed to send email via Gmail API',
        statusCode: error.status || 500,
        metadata: {
          originalError: error,
        }
      };
    }
  }
  
  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.gmail) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      await this.gmail.users.getProfile({ userId: 'me' });
      
      return {
        success: true,
        latencyMs: Date.now() - startTime,
        capabilities: this.capabilities,
      };
    } catch (error: any) {
      this.logError('testConnection', error);
      
      return {
        success: false,
        error: error.message || 'Gmail API connection test failed',
      };
    }
  }
  
  private createRawEmail(request: EmailSendRequest): string {
    const recipients = Array.isArray(request.to) ? request.to.join(', ') : request.to;
    
    let email = [
      `From: ${request.from.name ? `${request.from.name} <${request.from.email}>` : request.from.email}`,
      `To: ${recipients}`,
      `Subject: ${request.subject}`,
      'MIME-Version: 1.0',
    ];
    
    if (request.html && request.text) {
      const boundary = '----=_Part_' + Date.now();
      email.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      email.push('');
      
      // Text part
      email.push(`--${boundary}`);
      email.push('Content-Type: text/plain; charset=UTF-8');
      email.push('');
      email.push(request.text);
      email.push('');
      
      // HTML part
      email.push(`--${boundary}`);
      email.push('Content-Type: text/html; charset=UTF-8');
      email.push('');
      email.push(request.html);
      email.push('');
      email.push(`--${boundary}--`);
    } else if (request.html) {
      email.push('Content-Type: text/html; charset=UTF-8');
      email.push('');
      email.push(request.html);
    } else {
      email.push('Content-Type: text/plain; charset=UTF-8');
      email.push('');
      email.push(request.text || '');
    }
    
    return email.join('\r\n');
  }
}
```

---

## **Phase 5: Integration with Existing Codebase**
*Estimated: 5-7 days*

### **5.1 Refactor EmailProcessor**

**File: `server/src/services/email/EmailProcessor.ts` (key changes)**
```typescript
import { EmailProviderFactory } from '@/libs/email/EmailProviderFactory';
import { logger } from '@/libs/logger';
// Remove: import { sendgridClient } from '@/libs/email/sendgrid.client';

export class EmailProcessor {
  static async sendCampaignEmail(data: CampaignEmailData): Promise<EmailProcessorResult> {
    const {
      tenantId,
      campaignId,
      contactId,
      nodeId,
      subject,
      body,
      recipientEmail,
      recipientName,
      senderIdentity,
      // ... other fields
    } = data;

    try {
      // Get email provider for this sender identity
      const provider = await EmailProviderFactory.getProviderForSenderIdentity(
        senderIdentity.id,
        tenantId
      );

      // Prepare email content (existing logic)
      let emailBody = body;
      // ... calendar and signature processing logic remains the same ...

      const htmlBody = formatEmailBodyForHtml(emailBody);
      const textBody = formatEmailBodyForText(emailBody);

      // Use provider abstraction instead of direct SendGrid
      const sendResult = await provider.sendEmail({
        from: {
          email: senderIdentity.fromEmail,
          name: senderIdentity.fromName,
        },
        to: recipientEmail,
        subject,
        html: htmlBody,
        text: textBody,
        metadata: {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          dedupeKey,
        },
        categories: [...categories, `tenant:${tenantId}`],
      });

      if (!sendResult.success) {
        throw new Error(sendResult.error || 'Email send failed');
      }

      // Update outbound message record
      if (!skipMessageRecord) {
        await outboundMessageRepository.updateByIdForTenant(outboundMessageId, tenantId, {
          state: 'sent',
          providerMessageId: sendResult.providerMessageId,
          sentAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return {
        success: true,
        outboundMessageId,
        providerMessageId: sendResult.providerMessageId,
      };
    } catch (error) {
      // Error handling remains the same
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('[EmailProcessor] Email send failed', {
        tenantId,
        campaignId,
        contactId,
        nodeId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
```

### **5.2 Refactor SenderIdentity Service**

**File: `server/src/modules/email/senderIdentity.service.ts` (key changes)**
```typescript
import { EmailProviderFactory } from '@/libs/email/EmailProviderFactory';
// Keep: import { sendgridClient } from '@/libs/email/sendgrid.client'; // For backward compatibility

export class SenderIdentityService {
  static async createSenderIdentity(params: {
    tenantId: string;
    userId: string;
    fromEmail: string;
    fromName: string;
    providerConfigId?: string; // New field
    address?: string;
    city?: string;
    country?: string;
    emailSignature?: string;
  }): Promise<EmailSenderIdentity> {
    const { tenantId, userId, fromEmail, fromName, providerConfigId } = params;
    const domain = normalizeDomainFromEmail(fromEmail).toLowerCase();

    // Validate and sanitize email signature
    const sanitizedSignature = validateAndSanitizeSignature(params.emailSignature);

    // Check if domain is pre-approved for automatic verification
    const isDomainApproved = await domainValidationRepository.domainExists(domain);

    if (isDomainApproved) {
      // Skip provider validation and create as verified
      const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
        userId,
        fromEmail,
        fromName,
        domain,
        providerConfigId,
        validationStatus: 'verified',
        lastValidatedAt: new Date(),
        emailSignature: sanitizedSignature,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

      return created;
    }

    // Use provider-specific validation if provider is specified
    if (providerConfigId) {
      const provider = await EmailProviderFactory.getProviderForTenant(tenantId, providerConfigId);
      
      if (provider.createSenderIdentity) {
        const result = await provider.createSenderIdentity({
          email: fromEmail,
          name: fromName,
          address: params.address,
          city: params.city,
          country: params.country,
        });

        const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
          userId,
          fromEmail,
          fromName,
          domain,
          providerConfigId,
          validationStatus: result.verificationRequired ? 'pending' : 'verified',
          lastValidatedAt: result.verificationRequired ? undefined : new Date(),
          providerValidationData: {
            identityId: result.identityId,
            verificationUrl: result.verificationUrl,
          },
          emailSignature: sanitizedSignature,
          isDefault: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

        return created;
      }
    }

    // Fallback to legacy SendGrid validation for backward compatibility
    if (!params.address || !params.city) {
      const error: any = new Error('Validation error');
      error.statusCode = 422;
      error.details = [
        ...(!params.address ? [{ field: 'address', message: 'required' }] : []),
        ...(!params.city ? [{ field: 'city', message: 'required' }] : []),
      ];
      throw error;
    }

    // Legacy SendGrid flow
    const country = (params.country || 'USA').toUpperCase();
    const [_resp, body] = await sendgridClient.validateSender({
      email: fromEmail,
      name: fromName,
      address: params.address!,
      city: params.city!,
      country,
    });
    const sendgridId = extractSendgridIdFromBody(body);

    const created = await emailSenderIdentityRepository.createForTenant(tenantId, {
      userId,
      fromEmail,
      fromName,
      domain,
      providerConfigId,
      sendgridSenderId: sendgridId, // Legacy field
      validationStatus: 'pending',
      emailSignature: sanitizedSignature,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Omit<NewEmailSenderIdentity, 'tenantId'>);

    return created;
  }

  // ... other methods updated similarly to support provider abstraction
}
```

### **5.3 Create Repository for Provider Configs**

**File: `server/src/repositories/entities/EmailProviderConfigRepository.ts`**
```typescript
import { eq, and } from 'drizzle-orm';
import { TenantAwareRepository } from '../TenantAwareRepository';
import { 
  emailProviderConfigs, 
  type EmailProviderConfig, 
  type NewEmailProviderConfig 
} from '@/db/schema';

export class EmailProviderConfigRepository extends TenantAwareRepository<
  typeof emailProviderConfigs,
  EmailProviderConfig,
  NewEmailProviderConfig
> {
  constructor() {
    super(emailProviderConfigs);
  }

  async findDefaultForTenant(tenantId: string): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.isDefault, true),
          eq(this.table.isActive, true)
        )
      )
      .limit(1);

    return result[0] as EmailProviderConfig | undefined;
  }

  async findByNameForTenant(
    name: string, 
    tenantId: string
  ): Promise<EmailProviderConfig | undefined> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.name, name),
          eq(this.table.isActive, true)
        )
      )
      .limit(1);

    return result[0] as EmailProviderConfig | undefined;
  }

  async findActiveForTenant(tenantId: string): Promise<EmailProviderConfig[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.tenantId, tenantId),
          eq(this.table.isActive, true)
        )
      )) as EmailProviderConfig[];
  }

  async setDefault(configId: string, tenantId: string): Promise<EmailProviderConfig | undefined> {
    // First, unset all defaults for this tenant
    await this.db
      .update(this.table)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(this.table.tenantId, tenantId));

    // Then set the new default
    const result = await this.db
      .update(this.table)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(this.table.id, configId),
          eq(this.table.tenantId, tenantId)
        )
      )
      .returning();

    return result[0] as EmailProviderConfig | undefined;
  }
}

export const emailProviderConfigRepository = new EmailProviderConfigRepository();
```

---

## **Phase 6: Webhook Abstraction**
*Estimated: 4-6 days*

### **6.1 Create Webhook Abstraction Interface**

**File: `server/src/libs/email/webhooks/EmailWebhookProcessor.interface.ts`**
```typescript
export interface EmailWebhookProcessor {
  readonly providerType: string;
  
  processWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string
  ): Promise<WebhookProcessingResult>;
  
  validateWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string
  ): WebhookValidationResult;
}

export interface WebhookProcessingResult {
  success: boolean;
  webhookDeliveryId?: string;
  processedEvents: ProcessedEventResult[];
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  skippedEvents: number;
  errors: string[];
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  signature?: string;
}

export interface ProcessedEventResult {
  success: boolean;
  eventId: string;
  eventType: string;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}
```

### **6.2 Create Webhook Factory**

**File: `server/src/libs/email/webhooks/EmailWebhookFactory.ts`**
```typescript
import type { EmailWebhookProcessor } from './EmailWebhookProcessor.interface';
import type { EmailProviderType } from '../types/EmailConfig.types';
import { SendGridWebhookProcessor } from './SendGridWebhookProcessor';
import { SMTPWebhookProcessor } from './SMTPWebhookProcessor';
import { MicrosoftGraphWebhookProcessor } from './MicrosoftGraphWebhookProcessor';
import { GoogleWorkspaceWebhookProcessor } from './GoogleWorkspaceWebhookProcessor';

export class EmailWebhookFactory {
  private static processors = new Map<EmailProviderType, EmailWebhookProcessor>();
  
  static getProcessor(providerType: EmailProviderType): EmailWebhookProcessor {
    if (this.processors.has(providerType)) {
      return this.processors.get(providerType)!;
    }
    
    let processor: EmailWebhookProcessor;
    
    switch (providerType) {
      case 'sendgrid':
        processor = new SendGridWebhookProcessor();
        break;
      case 'smtp':
        processor = new SMTPWebhookProcessor();
        break;
      case 'microsoft_graph':
        processor = new MicrosoftGraphWebhookProcessor();
        break;
      case 'google_workspace':
        processor = new GoogleWorkspaceWebhookProcessor();
        break;
      default:
        throw new Error(`Unsupported webhook provider: ${providerType}`);
    }
    
    this.processors.set(providerType, processor);
    return processor;
  }
  
  static async processWebhook(
    providerType: EmailProviderType,
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string
  ): Promise<WebhookProcessingResult> {
    const processor = this.getProcessor(providerType);
    return processor.processWebhook(headers, rawPayload);
  }
}
```

### **6.3 Wrap Existing SendGrid Webhook as Processor**

**File: `server/src/libs/email/webhooks/SendGridWebhookProcessor.ts`**
```typescript
import { BaseEmailWebhookProcessor } from './BaseEmailWebhookProcessor';
import { sendGridWebhookService } from '@/modules/webhooks/sendgrid.webhook.service';
import type { 
  WebhookProcessingResult, 
  WebhookValidationResult 
} from './EmailWebhookProcessor.interface';

export class SendGridWebhookProcessor extends BaseEmailWebhookProcessor {
  readonly providerType = 'sendgrid';
  
  async processWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string
  ): Promise<WebhookProcessingResult> {
    // Delegate to existing SendGrid service
    return sendGridWebhookService.instance.processWebhook(headers, rawPayload);
  }
  
  validateWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawPayload: string
  ): WebhookValidationResult {
    // Use existing SendGrid validation logic
    const validator = SendGridWebhookValidator.fromEnvironment();
    const verification = validator.verifyWebhookRequest(headers, rawPayload);
    
    return {
      isValid: verification.isValid,
      error: verification.error,
      signature: verification.signature,
    };
  }
}
```

---

## **Phase 7: Configuration UI and Management**
*Estimated: 6-8 days*

### **7.1 Backend API Routes**

**File: `server/src/routes/emailProviders.routes.ts`**
```typescript
import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { emailProviderConfigRepository } from '@/repositories';
import { EmailProviderFactory } from '@/libs/email/EmailProviderFactory';
import { authenticate } from '@/plugins/authentication.plugin';

export default async function emailProviderRoutes(fastify: FastifyInstance) {
  fastify.register(authenticate);

  // Get all provider configs for tenant
  fastify.get('/email-providers', {
    schema: {
      response: {
        200: Type.Array(Type.Object({
          id: Type.String(),
          type: Type.String(),
          name: Type.String(),
          isDefault: Type.Boolean(),
          isActive: Type.Boolean(),
          capabilities: Type.Object({
            supportsSenderValidation: Type.Boolean(),
            supportsEmailValidation: Type.Boolean(),
            supportsWebhooks: Type.Boolean(),
            maxRecipientsPerEmail: Type.Number(),
          }),
          createdAt: Type.String(),
          updatedAt: Type.String(),
        }))
      }
    }
  }, async (request) => {
    const { tenantId } = request.user;
    
    const configs = await emailProviderConfigRepository.findActiveForTenant(tenantId);
    
    return configs.map(config => ({
      ...config,
      config: undefined, // Don't expose sensitive config
      encryptedCredentials: undefined, // Don't expose credentials
    }));
  });

  // Create new provider config
  fastify.post('/email-providers', {
    schema: {
      body: Type.Object({
        type: Type.Union([
          Type.Literal('sendgrid'),
          Type.Literal('smtp'),
          Type.Literal('microsoft_graph'),
          Type.Literal('google_workspace')
        ]),
        name: Type.String(),
        config: Type.Object({}, { additionalProperties: true }),
        credentials: Type.Optional(Type.Object({}, { additionalProperties: true })),
        isDefault: Type.Optional(Type.Boolean()),
      })
    }
  }, async (request) => {
    const { tenantId } = request.user;
    const { type, name, config, credentials, isDefault } = request.body;

    // Encrypt credentials if provided
    const encryptedCredentials = credentials 
      ? await encryptCredentials(credentials)
      : undefined;

    const created = await emailProviderConfigRepository.createForTenant(tenantId, {
      type,
      name,
      config,
      encryptedCredentials,
      isDefault: isDefault || false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return created;
  });

  // Test provider connection
  fastify.post('/email-providers/:id/test', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      })
    }
  }, async (request) => {
    const { tenantId } = request.user;
    const { id } = request.params;

    const config = await emailProviderConfigRepository.findByIdForTenant(id, tenantId);
    if (!config) {
      throw new Error('Provider config not found');
    }

    const provider = await EmailProviderFactory.createProvider(config);
    const result = await provider.testConnection();

    return result;
  });

  // Set default provider
  fastify.patch('/email-providers/:id/default', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      })
    }
  }, async (request) => {
    const { tenantId } = request.user;
    const { id } = request.params;

    const updated = await emailProviderConfigRepository.setDefault(id, tenantId);
    
    if (!updated) {
      throw new Error('Provider config not found');
    }

    return updated;
  });
}

async function encryptCredentials(credentials: Record<string, any>): Promise<string> {
  // Implementation depends on encryption library choice
  // Could use Node.js crypto module or a library like node-forge
  return JSON.stringify(credentials); // Placeholder - implement proper encryption
}
```

### **7.2 Frontend Components**

**File: `client/src/pages/settings/EmailProvidersPage.tsx`**
```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Check, AlertCircle } from 'lucide-react';
import { useEmailProviders } from '@/hooks/useEmailProviders';
import { EmailProviderForm } from '@/components/email/EmailProviderForm';
import { EmailProviderCard } from '@/components/email/EmailProviderCard';

export function EmailProvidersPage() {
  const { providers, loading, error, refetch } = useEmailProviders();
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Email Providers</h1>
          <p className="text-gray-600">
            Configure how emails are sent from your campaigns
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center text-red-600">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providers.map((provider) => (
          <EmailProviderCard
            key={provider.id}
            provider={provider}
            onEdit={setEditingProvider}
            onRefetch={refetch}
          />
        ))}
      </div>

      {showForm && (
        <EmailProviderForm
          provider={editingProvider}
          onClose={() => {
            setShowForm(false);
            setEditingProvider(null);
          }}
          onSuccess={() => {
            setShowForm(false);
            setEditingProvider(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
```

---

## **Phase 8: Testing and Validation**
*Estimated: 4-6 days*

### **8.1 Unit Tests for Providers**

**File: `server/src/libs/email/providers/__tests__/SMTPProvider.test.ts`**
```typescript
import { SMTPProvider } from '../SMTPProvider';
import type { SMTPConfig } from '../../types/EmailConfig.types';

describe('SMTPProvider', () => {
  const mockConfig: SMTPConfig = {
    type: 'smtp',
    tenantId: 'test-tenant',
    name: 'Test SMTP',
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    auth: {
      type: 'login',
      user: 'test@example.com',
      pass: 'password123',
    },
    isDefault: false,
    isActive: true,
  };

  let provider: SMTPProvider;

  beforeEach(() => {
    provider = new SMTPProvider(mockConfig);
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Mock nodemailer
      const mockSendMail = jest.fn().mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
        envelope: { from: 'test@example.com', to: ['recipient@example.com'] },
      });

      // Mock transporter
      jest.doMock('nodemailer', () => ({
        createTransporter: jest.fn(() => ({
          sendMail: mockSendMail,
          verify: jest.fn().mockResolvedValue(true),
        })),
      }));

      const result = await provider.sendEmail({
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'Test Sender <test@example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
        headers: undefined,
      });
    });

    it('should handle send errors', async () => {
      const mockError = new Error('SMTP connection failed');
      const mockSendMail = jest.fn().mockRejectedValue(mockError);

      jest.doMock('nodemailer', () => ({
        createTransporter: jest.fn(() => ({
          sendMail: mockSendMail,
        })),
      }));

      const result = await provider.sendEmail({
        from: { email: 'test@example.com' },
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockVerify = jest.fn().mockResolvedValue(true);

      jest.doMock('nodemailer', () => ({
        createTransporter: jest.fn(() => ({
          verify: mockVerify,
        })),
      }));

      const result = await provider.testConnection();

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(mockVerify).toHaveBeenCalled();
    });
  });
});
```

### **8.2 Integration Tests**

**File: `server/src/libs/email/__tests__/EmailProviderFactory.integration.test.ts`**
```typescript
import { EmailProviderFactory } from '../EmailProviderFactory';
import { SendGridProvider } from '../providers/SendGridProvider';
import { SMTPProvider } from '../providers/SMTPProvider';
import type { SendGridConfig, SMTPConfig } from '../types/EmailConfig.types';

describe('EmailProviderFactory Integration', () => {
  describe('createProvider', () => {
    it('should create SendGrid provider', async () => {
      const config: SendGridConfig = {
        type: 'sendgrid',
        tenantId: 'test-tenant',
        name: 'SendGrid',
        apiKey: 'test-api-key',
        isDefault: true,
        isActive: true,
      };

      const provider = await EmailProviderFactory.createProvider(config);

      expect(provider).toBeInstanceOf(SendGridProvider);
      expect(provider.providerType).toBe('sendgrid');
      expect(provider.capabilities.supportsSenderValidation).toBe(true);
    });

    it('should create SMTP provider', async () => {
      const config: SMTPConfig = {
        type: 'smtp',
        tenantId: 'test-tenant',
        name: 'SMTP',
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { type: 'login', user: 'test', pass: 'pass' },
        isDefault: false,
        isActive: true,
      };

      const provider = await EmailProviderFactory.createProvider(config);

      expect(provider).toBeInstanceOf(SMTPProvider);
      expect(provider.providerType).toBe('smtp');
      expect(provider.capabilities.supportsSenderValidation).toBe(false);
    });

    it('should cache providers', async () => {
      const config: SendGridConfig = {
        type: 'sendgrid',
        tenantId: 'test-tenant',
        name: 'SendGrid',
        apiKey: 'test-api-key',
        isDefault: true,
        isActive: true,
        id: 'config-1',
      };

      const provider1 = await EmailProviderFactory.createProvider(config);
      const provider2 = await EmailProviderFactory.createProvider(config);

      expect(provider1).toBe(provider2); // Same instance from cache
    });
  });
});
```

### **8.3 End-to-End Tests**

**File: `server/src/services/email/__tests__/EmailProcessor.e2e.test.ts`**
```typescript
import { EmailProcessor } from '../EmailProcessor';
import { emailProviderConfigRepository } from '@/repositories';
import type { CampaignEmailData } from '../EmailProcessor';

describe('EmailProcessor E2E', () => {
  beforeEach(async () => {
    // Setup test database with provider configs
    await setupTestProviderConfigs();
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  it('should send email via SMTP provider', async () => {
    const emailData: CampaignEmailData = {
      tenantId: 'test-tenant',
      campaignId: 'test-campaign',
      contactId: 'test-contact',
      nodeId: 'test-node',
      subject: 'Test Email',
      body: 'Test message body',
      recipientEmail: 'test@example.com',
      recipientName: 'Test Recipient',
      senderIdentity: {
        id: 'test-sender',
        fromEmail: 'sender@example.com',
        fromName: 'Test Sender',
        providerConfigId: 'smtp-config-1',
        // ... other fields
      },
    };

    const result = await EmailProcessor.sendCampaignEmail(emailData);

    expect(result.success).toBe(true);
    expect(result.outboundMessageId).toBeDefined();
    expect(result.providerMessageId).toBeDefined();
  });

  it('should fallback to default provider on failure', async () => {
    // Test provider fallback logic
    // Implementation depends on fallback strategy
  });
});

async function setupTestProviderConfigs() {
  // Create test provider configurations
  await emailProviderConfigRepository.createForTenant('test-tenant', {
    id: 'smtp-config-1',
    type: 'smtp',
    name: 'Test SMTP',
    config: {
      host: 'localhost',
      port: 1025, // MailHog test server
      secure: false,
      auth: { type: 'login', user: 'test', pass: 'test' },
    },
    isDefault: true,
    isActive: true,
  });
}

async function cleanupTestData() {
  // Clean up test database
}
```

---

## **Required Dependencies**

### **Package.json Updates**
```json
{
  "dependencies": {
    "nodemailer": "^6.9.8",
    "@types/nodemailer": "^6.4.14",
    "@azure/identity": "^4.0.1",
    "@microsoft/microsoft-graph-client": "^3.0.7",
    "googleapis": "^126.0.1",
    "google-auth-library": "^9.5.0"
  }
}
```

---

## **Migration Strategy**

### **Phase-by-Phase Rollout**
1. **Phase 1-3**: Foundation work, no customer impact
2. **Phase 4**: Implement providers, SendGrid remains default
3. **Phase 5**: Integrate with existing code, feature flag new providers
4. **Phase 6**: Enable webhook abstraction
5. **Phase 7**: Release UI for provider configuration
6. **Phase 8**: Full testing and gradual rollout

### **Backward Compatibility**
- Existing SendGrid configurations continue to work
- Legacy `sendgridSenderId` field preserved
- Gradual migration of sender identities to new provider system
- Feature flags to control rollout

### **Risk Mitigation**
- Comprehensive testing at each phase
- Rollback plans for each deployment
- Monitoring and alerting for email delivery metrics
- Gradual tenant migration with careful monitoring

---

## **Success Metrics**

### **Technical Metrics**
- Email delivery success rate maintained >99.5%
- Provider abstraction layer performance <50ms overhead
- Zero data loss during migration
- All existing email features continue to work

### **Business Metrics**
- Customer adoption of direct email providers
- Reduction in SendGrid dependency costs
- Improved customer satisfaction with email delivery control
- Support ticket reduction for email-related issues

This comprehensive plan provides a structured approach to implementing email provider abstraction while maintaining system reliability and backward compatibility.