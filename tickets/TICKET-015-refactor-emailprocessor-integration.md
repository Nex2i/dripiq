# TICKET-015: Refactor EmailProcessor Integration

## **Priority:** High
## **Estimated Time:** 2-3 days
## **Phase:** 5 - Integration with Existing Codebase
## **Dependencies:** TICKET-006, TICKET-014

---

## **Description**
Refactor the EmailProcessor class to use the new email provider abstraction layer instead of directly calling the SendGrid client. This ensures all email sending goes through the provider system while maintaining backward compatibility.

## **Acceptance Criteria**

### **Must Have**
- [ ] Replace direct SendGrid client usage with provider factory
- [ ] Maintain all existing EmailProcessor functionality
- [ ] Ensure backward compatibility with existing email sending
- [ ] Support provider failover and error handling
- [ ] Preserve existing logging and monitoring

### **Should Have**
- [ ] Add provider-specific error mapping
- [ ] Implement graceful fallback to legacy SendGrid
- [ ] Include provider selection logic
- [ ] Add performance monitoring for provider usage

### **Could Have**
- [ ] Support A/B testing between providers
- [ ] Add provider health monitoring
- [ ] Implement intelligent provider routing

## **Technical Requirements**

### **Current EmailProcessor Analysis**
The current `EmailProcessor.ts` directly imports and uses `sendgridClient`:
```typescript
import { sendgridClient } from '@/libs/email/sendgrid.client';
// ...
const providerIds = await sendgridClient.sendEmail(sendPayload);
```

### **Refactored EmailProcessor Implementation**
**File:** `server/src/services/email/EmailProcessor.ts` (updated)

```typescript
import { createId } from '@paralleldrive/cuid2';
import { logger } from '@/libs/logger';
import { EmailProviderFactory } from '@/libs/email/EmailProviderFactory';
import { calendarUrlWrapper } from '@/libs/calendar/calendarUrlWrapper';
import {
  formatEmailBodyForHtml,
  formatEmailBodyForText,
  containsHtml,
} from '@/utils/emailFormatting';
import { outboundMessageRepository } from '@/repositories';
import type { EmailSendRequest } from '@/libs/email/types/EmailProvider.types';
import { EmailProviderError, EMAIL_ERROR_CODES } from '@/libs/email/types/EmailErrors.types';
import type { EmailSenderIdentity } from '@/db';

// Keep existing interfaces for backward compatibility
export interface CampaignEmailData {
  // Core email data
  tenantId: string;
  campaignId: string;
  contactId: string;
  nodeId: string;

  // Email content
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName: string;

  // Sender info (pre-fetched, pre-validated)
  senderIdentity: EmailSenderIdentity;

  // Calendar info (optional, pre-fetched)
  calendarInfo?: {
    calendarLink: string;
    calendarTieIn: string;
    leadId: string;
  };

  // Processing options
  skipMessageRecord?: boolean; // For test emails
  skipTimeoutScheduling?: boolean; // For test emails
  categories?: string[];

  // Optional dedupe key (will be generated if not provided)
  dedupeKey?: string;
}

export interface EmailProcessorResult {
  success: boolean;
  outboundMessageId?: string;
  providerMessageId?: string;
  providerType?: string; // New field to track which provider was used
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Pure email processing class that handles core email sending logic
 * Now uses provider abstraction layer instead of direct SendGrid
 */
export class EmailProcessor {
  private static enableProviderMigration = process.env.ENABLE_PROVIDER_MIGRATION !== 'false';
  private static legacyFallbackEnabled = process.env.ENABLE_LEGACY_FALLBACK !== 'false';

  /**
   * Sends a campaign email with the provided data
   * @param data Complete email data with all dependencies resolved
   * @returns Result of the email sending operation
   */
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
      calendarInfo,
      skipMessageRecord = false,
      categories = ['campaign'],
    } = data;

    try {
      // Validate email content
      if (!subject || !subject.trim()) {
        throw new Error('Email subject is required');
      }

      if (!body || !body.trim()) {
        throw new Error('Email body is required');
      }

      if (!recipientEmail || !recipientEmail.trim()) {
        throw new Error('Recipient email is required');
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        throw new Error('Invalid recipient email format');
      }

      // Generate dedupe key if not provided
      const dedupeKey = data.dedupeKey || `${tenantId}:${campaignId}:${contactId}:${nodeId}:email`;

      // Create outbound message ID (used for tracking even if not recording)
      const outboundMessageId = createId();

      // Prepare email body with signature and calendar information
      let emailBody = await this.prepareEmailBody(
        body,
        calendarInfo,
        senderIdentity,
        {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          outboundMessageId,
        }
      );

      // Create outbound message record if not skipping
      if (!skipMessageRecord) {
        await outboundMessageRepository.createForTenant(tenantId, {
          id: outboundMessageId,
          campaignId,
          contactId,
          channel: 'email',
          senderIdentityId: senderIdentity.id,
          dedupeKey,
          content: {
            subject,
            body,
            to: recipientEmail,
            toName: recipientName,
          },
          state: 'queued',
          scheduledAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Send email using provider system
      const sendResult = await this.sendEmailViaProvider(
        {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          dedupeKey,
          subject,
          body: emailBody,
          recipientEmail,
          recipientName,
          senderIdentity,
          categories,
        },
        skipMessageRecord
      );

      // Update outbound message with success if not skipping
      if (!skipMessageRecord && sendResult.success) {
        await outboundMessageRepository.updateByIdForTenant(outboundMessageId, tenantId, {
          state: 'sent',
          providerMessageId: sendResult.providerMessageId,
          sentAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return {
        success: sendResult.success,
        outboundMessageId,
        providerMessageId: sendResult.providerMessageId,
        providerType: sendResult.providerType,
        error: sendResult.error,
      };
    } catch (error) {
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

  /**
   * Send email using the provider system with fallback support
   */
  private static async sendEmailViaProvider(
    emailData: {
      tenantId: string;
      campaignId: string;
      nodeId: string;
      outboundMessageId: string;
      dedupeKey: string;
      subject: string;
      body: string;
      recipientEmail: string;
      recipientName: string;
      senderIdentity: EmailSenderIdentity;
      categories: string[];
    },
    skipMessageRecord: boolean
  ): Promise<{
    success: boolean;
    providerMessageId?: string;
    providerType?: string;
    error?: string;
  }> {
    const {
      tenantId,
      campaignId,
      nodeId,
      outboundMessageId,
      dedupeKey,
      subject,
      body: emailBody,
      recipientEmail,
      recipientName,
      senderIdentity,
      categories,
    } = emailData;

    let providerError: any = null;

    // Try provider system first
    if (this.enableProviderMigration) {
      try {
        logger.info('[EmailProcessor] Attempting email send via provider system', {
          tenantId,
          campaignId,
          contactId: emailData.recipientEmail,
          nodeId,
          outboundMessageId,
          senderIdentityId: senderIdentity.id,
        });

        // Get email provider for this sender identity
        const provider = await EmailProviderFactory.getProviderForSenderIdentity(
          senderIdentity.id,
          tenantId
        );

        // Prepare email content for provider
        const htmlBody = formatEmailBodyForHtml(emailBody);
        const textBody = formatEmailBodyForText(emailBody);

        const sendRequest: EmailSendRequest = {
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
            environment: process.env.NODE_ENV || 'development',
          },
          categories: [...categories, `tenant:${tenantId}`],
        };

        // Send email via provider
        const result = await provider.sendEmail(sendRequest);

        if (result.success) {
          logger.info('[EmailProcessor] Email sent successfully via provider system', {
            tenantId,
            campaignId,
            nodeId,
            outboundMessageId,
            providerType: provider.providerType,
            providerMessageId: result.providerMessageId,
            skipMessageRecord,
          });

          return {
            success: true,
            providerMessageId: result.providerMessageId,
            providerType: provider.providerType,
          };
        } else {
          // Provider returned failure
          providerError = new Error(result.error || 'Provider send failed');
          providerError.providerType = provider.providerType;
          throw providerError;
        }
      } catch (error) {
        providerError = error;
        
        logger.warn('[EmailProcessor] Provider system failed, considering fallback', {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          error: error instanceof Error ? error.message : 'Unknown error',
          providerType: (error as any)?.providerType,
          fallbackEnabled: this.legacyFallbackEnabled,
        });

        // If provider system fails and fallback is disabled, return the error
        if (!this.legacyFallbackEnabled) {
          throw error;
        }
      }
    }

    // Fallback to legacy SendGrid (if enabled)
    if (this.legacyFallbackEnabled) {
      try {
        logger.info('[EmailProcessor] Falling back to legacy SendGrid', {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          providerError: providerError?.message,
        });

        // Use legacy SendGrid client
        const { sendgridClient } = await import('@/libs/email/sendgrid.client');
        
        const htmlBody = formatEmailBodyForHtml(emailBody);
        const textBody = formatEmailBodyForText(emailBody);

        const sendPayload = {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          dedupeKey,
          from: {
            email: senderIdentity.fromEmail,
            name: senderIdentity.fromName,
          },
          to: recipientEmail,
          subject,
          html: htmlBody,
          text: textBody,
          categories: [...categories, `tenant:${tenantId}`],
        };

        const providerIds = await sendgridClient.sendEmail(sendPayload);

        logger.info('[EmailProcessor] Email sent successfully via legacy SendGrid', {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          providerMessageId: providerIds.providerMessageId,
          responseStatus: providerIds.responseStatus,
          skipMessageRecord,
        });

        return {
          success: true,
          providerMessageId: providerIds.providerMessageId,
          providerType: 'sendgrid_legacy',
        };
      } catch (legacyError) {
        logger.error('[EmailProcessor] Legacy SendGrid fallback also failed', {
          tenantId,
          campaignId,
          nodeId,
          outboundMessageId,
          providerError: providerError?.message,
          legacyError: legacyError instanceof Error ? legacyError.message : 'Unknown error',
        });

        // Return the more specific error (provider error if available)
        throw providerError || legacyError;
      }
    }

    // No fallback available, throw provider error
    throw providerError || new Error('No email provider available');
  }

  /**
   * Prepare email body with calendar information and signature
   * (Extracted from existing logic for better organization)
   */
  private static async prepareEmailBody(
    body: string,
    calendarInfo?: {
      calendarLink: string;
      calendarTieIn: string;
      leadId: string;
    },
    senderIdentity?: EmailSenderIdentity,
    trackingData?: {
      tenantId: string;
      campaignId: string;
      contactId: string;
      nodeId: string;
      outboundMessageId: string;
    }
  ): Promise<string> {
    let emailBody = body;

    // Add calendar information if provided
    if (calendarInfo?.calendarLink && calendarInfo?.calendarTieIn && trackingData) {
      try {
        const trackedCalendarUrl = calendarUrlWrapper.generateTrackedCalendarUrl({
          tenantId: trackingData.tenantId,
          leadId: calendarInfo.leadId,
          contactId: trackingData.contactId,
          campaignId: trackingData.campaignId,
          nodeId: trackingData.nodeId,
          outboundMessageId: trackingData.outboundMessageId,
        });

        const calendarMessage = calendarUrlWrapper.createCalendarMessage(
          calendarInfo.calendarTieIn,
          trackedCalendarUrl
        );

        // Append calendar message to email body
        if (containsHtml(emailBody)) {
          const htmlCalendarMessage = containsHtml(calendarMessage)
            ? calendarMessage
            : calendarMessage.replace(/\n/g, '<br>');
          emailBody = `${emailBody}<br><br>${htmlCalendarMessage}`;
        } else {
          emailBody = `${emailBody}\n\n${calendarMessage}`;
        }

        logger.info('[EmailProcessor] Calendar message appended to email', {
          tenantId: trackingData.tenantId,
          campaignId: trackingData.campaignId,
          contactId: trackingData.contactId,
          nodeId: trackingData.nodeId,
          calendarTieIn: calendarInfo.calendarTieIn,
          trackedUrl: trackedCalendarUrl,
        });
      } catch (calendarError) {
        logger.error('[EmailProcessor] Failed to append calendar information', {
          tenantId: trackingData?.tenantId,
          campaignId: trackingData?.campaignId,
          contactId: trackingData?.contactId,
          nodeId: trackingData?.nodeId,
          error: calendarError instanceof Error ? calendarError.message : 'Unknown error',
        });
        // Continue without calendar info - don't fail the email send
      }
    }

    // Add email signature if available
    if (senderIdentity?.emailSignature?.trim()) {
      const signature = senderIdentity.emailSignature.trim();

      const bodyHasHtml = containsHtml(emailBody);
      const signatureHasHtml = containsHtml(signature);

      if (bodyHasHtml || signatureHasHtml) {
        // HTML mode: convert plain text parts to HTML for consistency
        const htmlBody = bodyHasHtml ? emailBody : emailBody.replace(/\n/g, '<br>');
        const htmlSignature = signatureHasHtml ? signature : signature.replace(/\n/g, '<br>');
        emailBody = `${htmlBody}<br><br>${htmlSignature}`;
      } else {
        // Plain text mode: use simple newlines
        emailBody = `${emailBody}\n\n${signature}`;
      }

      logger.info('[EmailProcessor] Email signature appended', {
        tenantId: trackingData?.tenantId,
        campaignId: trackingData?.campaignId,
        contactId: trackingData?.contactId,
        nodeId: trackingData?.nodeId,
        senderIdentityId: senderIdentity.id,
        signatureLength: signature.length,
        signatureIsHtml: signatureHasHtml,
        bodyIsHtml: bodyHasHtml,
      });
    }

    return emailBody;
  }

  /**
   * Send test email using provider system
   * New method for test email functionality
   */
  static async sendTestEmail(
    tenantId: string,
    senderIdentityId: string,
    testEmailData: {
      to: string;
      subject: string;
      body: string;
    }
  ): Promise<EmailProcessorResult> {
    try {
      logger.info('[EmailProcessor] Sending test email', {
        tenantId,
        senderIdentityId,
        to: testEmailData.to,
        subject: testEmailData.subject,
      });

      // Get sender identity
      const { emailSenderIdentityRepository } = await import('@/repositories');
      const senderIdentity = await emailSenderIdentityRepository.findByIdForTenant(
        senderIdentityId,
        tenantId
      );

      if (!senderIdentity) {
        throw new Error('Sender identity not found');
      }

      // Get email provider
      const provider = await EmailProviderFactory.getProviderForSenderIdentity(
        senderIdentityId,
        tenantId
      );

      // Prepare test email
      const htmlBody = formatEmailBodyForHtml(testEmailData.body);
      const textBody = formatEmailBodyForText(testEmailData.body);

      const sendRequest: EmailSendRequest = {
        from: {
          email: senderIdentity.fromEmail,
          name: senderIdentity.fromName,
        },
        to: testEmailData.to,
        subject: testEmailData.subject,
        html: htmlBody,
        text: textBody,
        metadata: {
          tenantId,
          test_email: true,
          environment: process.env.NODE_ENV || 'development',
        },
        categories: ['test', `tenant:${tenantId}`],
      };

      // Send via provider
      const result = await provider.sendEmail(sendRequest);

      if (result.success) {
        logger.info('[EmailProcessor] Test email sent successfully', {
          tenantId,
          senderIdentityId,
          providerType: provider.providerType,
          providerMessageId: result.providerMessageId,
        });

        return {
          success: true,
          providerMessageId: result.providerMessageId,
          providerType: provider.providerType,
        };
      } else {
        throw new Error(result.error || 'Test email send failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('[EmailProcessor] Test email failed', {
        tenantId,
        senderIdentityId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get available email providers for a tenant
   * New method for provider management
   */
  static async getAvailableProviders(tenantId: string): Promise<{
    providers: Array<{
      type: string;
      name: string;
      isDefault: boolean;
      isHealthy: boolean;
      capabilities: any;
    }>;
    defaultProvider?: string;
  }> {
    try {
      const providers = await EmailProviderFactory.getAvailableProviders(tenantId);
      const healthResults = await EmailProviderFactory.testAllProviders(tenantId);

      const providerInfo = providers.map(provider => ({
        type: provider.providerType,
        name: provider.config.name,
        isDefault: provider.config.isDefault || false,
        isHealthy: healthResults.get(provider.config.name) || false,
        capabilities: provider.capabilities,
      }));

      const defaultProvider = providerInfo.find(p => p.isDefault)?.name;

      return {
        providers: providerInfo,
        defaultProvider,
      };
    } catch (error) {
      logger.error('[EmailProcessor] Failed to get available providers', {
        tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        providers: [],
      };
    }
  }
}
```

## **Integration with Existing Code**

### **Update Email Execution Service**
**File:** `server/src/workers/campaign-execution/email-execution.service.ts` (key changes)

```typescript
// Update import to remove direct SendGrid dependency
// Remove: import { sendgridClient } from '@/libs/email/sendgrid.client';

export class EmailExecutionService {
  // ... existing code ...

  async executeEmailSend(params: EmailExecutionParams): Promise<EmailExecutionResult> {
    // ... existing validation code ...

    try {
      // Use the updated EmailProcessor which now uses provider system
      const result = await EmailProcessor.sendCampaignEmail({
        tenantId,
        campaignId,
        contactId,
        nodeId,
        subject: node.subject!,
        body: node.body!,
        recipientEmail: contact.email,
        recipientName: contact.name || contact.email,
        senderIdentity: resolvedSenderIdentity,
        calendarInfo,
        skipMessageRecord: false,
        skipTimeoutScheduling: false,
        categories: ['campaign'],
      });

      // Log provider information for monitoring
      if (result.providerType) {
        logger.info('[EmailExecutionService] Email sent via provider', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          providerType: result.providerType,
          providerMessageId: result.providerMessageId,
        });
      }

      return {
        success: result.success,
        outboundMessageId: result.outboundMessageId,
        providerMessageId: result.providerMessageId,
        error: result.error,
        skipped: result.skipped,
        skipReason: result.skipReason,
      };
    } catch (error) {
      // ... existing error handling ...
    }
  }

  // ... rest of existing code remains the same ...
}
```

### **Environment Variable Configuration**
**File:** `server/.env.example` (additions)

```bash
# Email Provider Migration Settings
ENABLE_PROVIDER_MIGRATION=true
ENABLE_LEGACY_FALLBACK=true

# Provider Selection Strategy
EMAIL_PROVIDER_STRATEGY=sender_identity  # sender_identity | tenant_default | round_robin

# Performance Monitoring
ENABLE_PROVIDER_METRICS=true
PROVIDER_HEALTH_CHECK_INTERVAL=300000  # 5 minutes
```

## **Error Handling and Monitoring**

### **Provider Error Mapping**
```typescript
// Add to EmailProcessor class
private static mapProviderError(error: any): {
  userMessage: string;
  internalCode: string;
  shouldRetry: boolean;
} {
  if (error instanceof EmailProviderError) {
    switch (error.code) {
      case EMAIL_ERROR_CODES.RATE_LIMIT_EXCEEDED:
        return {
          userMessage: 'Email sending temporarily limited. Please try again later.',
          internalCode: 'RATE_LIMITED',
          shouldRetry: true,
        };
      
      case EMAIL_ERROR_CODES.INVALID_CREDENTIALS:
        return {
          userMessage: 'Email provider authentication failed. Please check configuration.',
          internalCode: 'AUTH_FAILED',
          shouldRetry: false,
        };
      
      case EMAIL_ERROR_CODES.PROVIDER_UNAVAILABLE:
        return {
          userMessage: 'Email service temporarily unavailable.',
          internalCode: 'SERVICE_DOWN',
          shouldRetry: true,
        };
      
      default:
        return {
          userMessage: 'Email sending failed. Please try again.',
          internalCode: 'UNKNOWN_PROVIDER_ERROR',
          shouldRetry: false,
        };
    }
  }
  
  return {
    userMessage: 'Email sending failed unexpectedly.',
    internalCode: 'UNKNOWN_ERROR',
    shouldRetry: false,
  };
}
```

### **Performance Monitoring**
```typescript
// Add monitoring hooks to EmailProcessor
private static async recordProviderMetrics(
  providerType: string,
  operation: string,
  duration: number,
  success: boolean
): Promise<void> {
  if (process.env.ENABLE_PROVIDER_METRICS !== 'true') {
    return;
  }

  // Record metrics (implementation depends on monitoring system)
  logger.info('[EmailProcessor] Provider metrics', {
    providerType,
    operation,
    duration,
    success,
    timestamp: new Date().toISOString(),
  });

  // Could integrate with metrics systems like:
  // - Prometheus
  // - DataDog
  // - CloudWatch
  // - Internal metrics database
}
```

## **Testing Requirements**

### **Unit Tests**
- [ ] Test provider selection logic
- [ ] Test fallback mechanism
- [ ] Test error handling and mapping
- [ ] Test backward compatibility

### **Integration Tests**
- [ ] Test with real providers
- [ ] Test failover scenarios
- [ ] Test performance impact
- [ ] Test monitoring and logging

### **Test Files**
```
server/src/services/email/__tests__/EmailProcessor.refactor.test.ts
server/src/services/email/__tests__/EmailProcessor.integration.test.ts
server/src/services/email/__tests__/EmailProcessor.backward-compatibility.test.ts
```

### **Backward Compatibility Tests**
```typescript
describe('EmailProcessor Backward Compatibility', () => {
  it('should maintain existing interface', async () => {
    const data: CampaignEmailData = {
      // ... existing data structure
    };

    const result = await EmailProcessor.sendCampaignEmail(data);

    // Should have same result structure as before
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('outboundMessageId');
    expect(result).toHaveProperty('providerMessageId');
    // New field should be optional
    expect(result.providerType).toBeDefined();
  });

  it('should work with legacy SendGrid when provider system disabled', async () => {
    process.env.ENABLE_PROVIDER_MIGRATION = 'false';
    
    // Should still work with existing logic
    const result = await EmailProcessor.sendCampaignEmail(testData);
    
    expect(result.success).toBe(true);
    expect(result.providerType).toBe('sendgrid_legacy');
  });
});
```

## **Performance Considerations**

### **Provider Caching**
- [ ] Reuse provider instances across requests
- [ ] Cache provider health status
- [ ] Optimize provider selection logic

### **Fallback Performance**
- [ ] Minimize fallback detection time
- [ ] Avoid cascade failures
- [ ] Monitor fallback usage rates

## **Deployment Strategy**

### **Feature Flags**
- [ ] `ENABLE_PROVIDER_MIGRATION` - Enable new provider system
- [ ] `ENABLE_LEGACY_FALLBACK` - Enable fallback to SendGrid
- [ ] `PROVIDER_HEALTH_CHECKS` - Enable provider health monitoring

### **Rollout Plan**
1. **Phase 1**: Deploy with `ENABLE_PROVIDER_MIGRATION=false` (no change)
2. **Phase 2**: Enable migration for test tenants
3. **Phase 3**: Gradual rollout to all tenants
4. **Phase 4**: Disable legacy fallback after validation

## **Documentation Requirements**
- [ ] Update EmailProcessor API documentation
- [ ] Document provider selection logic
- [ ] Include monitoring and troubleshooting guide
- [ ] Update deployment procedures

## **Definition of Done**
- [ ] EmailProcessor refactored to use provider system
- [ ] Backward compatibility maintained
- [ ] Provider fallback mechanism working
- [ ] Error handling comprehensive
- [ ] Performance monitoring implemented
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Code review completed

## **Notes**
- Maintain exact same interface for existing functionality
- Ensure no performance regression
- Monitor provider usage patterns after deployment
- Plan for gradual migration rollout

## **Related Tickets**
- TICKET-006: Email Provider Factory (prerequisite)
- TICKET-014: Data Migration and Backward Compatibility (prerequisite)
- TICKET-016: Update SenderIdentity Service
- TICKET-017: Webhook Abstraction Layer