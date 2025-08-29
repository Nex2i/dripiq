# TICKET-001: Create Email Provider Type Definitions

## **Priority:** High
## **Estimated Time:** 1-2 days
## **Phase:** 1 - Foundation
## **Dependencies:** None

---

## **Description**
Create the foundational type definitions for the email provider abstraction layer. This includes defining core interfaces for email requests, responses, and provider configurations.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `EmailProvider.types.ts` with core type definitions
- [ ] Define `EmailProviderType` enum for supported providers
- [ ] Create `EmailSendRequest` interface for standardized email sending
- [ ] Create `EmailSendResult` interface for provider responses
- [ ] Define `EmailProviderCapabilities` interface for provider features
- [ ] Create `ConnectionTestResult` interface for connection testing
- [ ] All types are properly exported and documented
- [ ] Types support extensibility for future providers

### **Should Have**
- [ ] Include TypeScript JSDoc comments for all interfaces
- [ ] Add validation helpers for type checking
- [ ] Include examples in comments

### **Could Have**
- [ ] Create utility types for common patterns
- [ ] Add generic types for provider-specific extensions

## **Technical Requirements**

### **File Location**
```
server/src/libs/email/types/EmailProvider.types.ts
```

### **Key Types to Implement**

```typescript
export type EmailProviderType = 'sendgrid' | 'smtp' | 'microsoft_graph' | 'google_workspace';

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
```

## **Testing Requirements**

### **Unit Tests**
- [ ] Test type definitions compile correctly
- [ ] Test type guards work as expected
- [ ] Validate that all required fields are enforced

### **Test Files**
```
server/src/libs/email/types/__tests__/EmailProvider.types.test.ts
```

## **Documentation Requirements**
- [ ] Add comprehensive JSDoc comments
- [ ] Include usage examples in type definitions
- [ ] Document the rationale for each field

## **Definition of Done**
- [ ] All types defined and exported
- [ ] TypeScript compilation passes
- [ ] Unit tests written and passing
- [ ] Code review completed
- [ ] Documentation updated

## **Notes**
- These types will be the foundation for all other email provider work
- Consider future extensibility when designing interfaces
- Ensure types are generic enough to support all planned providers
- Follow existing codebase naming conventions

## **Related Tickets**
- TICKET-002: Email Configuration Types
- TICKET-003: Email Error Types
- TICKET-004: Email Provider Interface