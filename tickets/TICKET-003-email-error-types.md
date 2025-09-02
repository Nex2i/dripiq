# TICKET-003: Create Email Error Types and Handling

## **Priority:** Medium
## **Estimated Time:** 1 day
## **Phase:** 1 - Foundation
## **Dependencies:** TICKET-001

---

## **Description**
Create standardized error types and error handling mechanisms for the email provider abstraction layer. This ensures consistent error reporting across all providers and proper error categorization.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create `EmailErrors.types.ts` with error definitions
- [ ] Define `EmailProviderError` class extending Error
- [ ] Create error code constants for common error scenarios
- [ ] Include provider-specific error context
- [ ] Support error categorization (auth, config, sending, etc.)
- [ ] Include HTTP status code mapping for API errors

### **Should Have**
- [ ] Error serialization for logging and monitoring
- [ ] Error recovery suggestions where applicable
- [ ] Structured error details for debugging

### **Could Have**
- [ ] Error telemetry integration
- [ ] Automatic retry logic recommendations

## **Technical Requirements**

### **File Location**
```
server/src/libs/email/types/EmailErrors.types.ts
```

### **Key Types to Implement**

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
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      provider: this.provider,
      details: this.details,
      stack: this.stack,
    };
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

export type EmailErrorCode = typeof EMAIL_ERROR_CODES[keyof typeof EMAIL_ERROR_CODES];
```

## **Error Categories**

### **Authentication Errors (4xx)**
- Invalid API keys or credentials
- Expired OAuth tokens
- Insufficient permissions

### **Configuration Errors (4xx)**
- Missing required configuration
- Invalid server settings
- Connection failures

### **Request Errors (4xx)**
- Invalid email addresses
- Message too large
- Malformed requests

### **Rate Limiting (4xx)**
- API rate limits exceeded
- Sending quotas reached

### **Provider Errors (5xx)**
- Service unavailable
- Internal provider errors
- Network timeouts

## **Integration Requirements**
- [ ] Integrate with existing logger for structured logging
- [ ] Support error reporting to monitoring systems
- [ ] Include correlation IDs for request tracing
- [ ] Map to appropriate HTTP status codes for API responses

## **Testing Requirements**

### **Unit Tests**
- [ ] Test error creation and serialization
- [ ] Validate error code constants
- [ ] Test error inheritance and type checking
- [ ] Verify JSON serialization works correctly

### **Test Files**
```
server/src/libs/email/types/__tests__/EmailErrors.types.test.ts
```

## **Error Handling Best Practices**
- [ ] Always include provider context in errors
- [ ] Preserve original error information when wrapping
- [ ] Use appropriate HTTP status codes
- [ ] Include actionable error messages
- [ ] Support error localization (future consideration)

## **Logging Integration**
```typescript
// Example error logging
logger.error('Email provider error', {
  error: emailError.toJSON(),
  tenantId: request.tenantId,
  operation: 'sendEmail',
  correlationId: request.correlationId,
});
```

## **Documentation Requirements**
- [ ] Document all error codes with descriptions
- [ ] Include error handling examples
- [ ] Document retry strategies for different error types
- [ ] Create troubleshooting guide for common errors

## **Definition of Done**
- [ ] Error types implemented and exported
- [ ] Error codes defined and documented
- [ ] Integration with logging system completed
- [ ] Unit tests written and passing
- [ ] Error handling examples documented
- [ ] Code review completed

## **Notes**
- Consider how errors will be displayed in the UI
- Plan for internationalization of error messages
- Ensure errors don't leak sensitive information (credentials)
- Design for both user-facing and developer-facing error messages

## **Related Tickets**
- TICKET-001: Email Provider Types (prerequisite)
- TICKET-004: Email Provider Interface
- TICKET-005: Base Email Provider