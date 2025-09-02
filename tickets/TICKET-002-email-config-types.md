# TICKET-002: Create Email Configuration Types

## **Priority:** High
## **Estimated Time:** 1-2 days
## **Phase:** 1 - Foundation
## **Dependencies:** TICKET-001

---

## **Description**
Define configuration types for all supported email providers. This includes base configuration interfaces and provider-specific configuration types for SendGrid, SMTP, Microsoft Graph, and Google Workspace.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `EmailConfig.types.ts` with provider configuration types
- [ ] Define `BaseProviderConfig` interface for common fields
- [ ] Create `SendGridConfig` interface for SendGrid-specific settings
- [ ] Create `SMTPConfig` interface for SMTP server configuration
- [ ] Create `MicrosoftGraphConfig` interface for Microsoft 365 integration
- [ ] Create `GoogleWorkspaceConfig` interface for Google Workspace integration
- [ ] Create union type `ProviderConfig` for type safety
- [ ] All configurations include authentication options

### **Should Have**
- [ ] Include validation rules in type definitions
- [ ] Add optional fields with sensible defaults
- [ ] Support both basic auth and OAuth2 for applicable providers

### **Could Have**
- [ ] Add helper types for common configuration patterns
- [ ] Include configuration templates/examples

## **Technical Requirements**

### **File Location**
```
server/src/libs/email/types/EmailConfig.types.ts
```

### **Key Types to Implement**

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
  secure: boolean;
  auth: {
    type: 'login' | 'oauth2';
    user: string;
    pass?: string;
    accessToken?: string;
    refreshToken?: string;
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
  clientSecret?: string;
  scopes: string[];
  authorityUrl?: string;
  authType: 'client_credentials' | 'delegated';
}

export interface GoogleWorkspaceConfig extends BaseProviderConfig {
  type: 'google_workspace';
  authType: 'service_account' | 'oauth2';
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
  delegatedUser?: string;
  scopes: string[];
  clientId?: string;
  clientSecret?: string;
}

export type ProviderConfig = SendGridConfig | SMTPConfig | MicrosoftGraphConfig | GoogleWorkspaceConfig;
```

## **Security Considerations**
- [ ] Sensitive fields (API keys, secrets) should be marked for encryption
- [ ] Private keys should support proper formatting (newline handling)
- [ ] OAuth tokens should be stored separately from main config
- [ ] Include field-level security annotations

## **Validation Requirements**
- [ ] Each provider config should validate required fields
- [ ] Email addresses should be validated
- [ ] URLs should be validated for authority fields
- [ ] Port numbers should be within valid range

## **Testing Requirements**

### **Unit Tests**
- [ ] Test that discriminated unions work correctly
- [ ] Validate required fields for each provider type
- [ ] Test type guards for configuration validation

### **Test Files**
```
server/src/libs/email/types/__tests__/EmailConfig.types.test.ts
```

## **Documentation Requirements**
- [ ] Document each configuration field with examples
- [ ] Include setup guides for each provider type
- [ ] Document security best practices for credential storage

## **Definition of Done**
- [ ] All configuration types defined and exported
- [ ] TypeScript compilation passes with strict mode
- [ ] Unit tests written and passing
- [ ] Security review completed
- [ ] Code review completed
- [ ] Documentation updated

## **Notes**
- Consider how configurations will be stored in database (JSONB)
- Ensure sensitive data can be encrypted before storage
- Plan for configuration migration from existing SendGrid setup
- Support both development and production configurations

## **Related Tickets**
- TICKET-001: Email Provider Types (prerequisite)
- TICKET-003: Email Error Types
- TICKET-007: Database Schema for Provider Configs