# Unsubscribe System Implementation Plan

## 📋 Overview

This document outlines the comprehensive implementation plan for adding unsubscribe functionality to the email campaign system. The implementation uses a channel-based approach that tracks unsubscribe status by email address and tenant ID, ensuring persistence across contact re-uploads and data changes.

## 🎯 Goals

- ✅ Add unsubscribe links to all outgoing emails
- ✅ Create unsubscribe endpoint and frontend confirmation page  
- ✅ Update campaign workers to check unsubscribe status before sending
- ✅ Handle SendGrid webhook unsubscribe events
- ✅ Ensure unsubscribe status persists across contact re-uploads
- ✅ Maintain compliance with email regulations (CAN-SPAM, GDPR)

## 🏗️ Architecture

### Database Design
- **Channel-based tracking**: Store unsubscribes by `(tenant_id, channel, channel_value)`
- **Persistence**: Unsubscribe status survives contact deletions/re-uploads
- **Multi-channel ready**: Extensible to SMS, push notifications, etc.

### User Flow
```
1. User receives email with unsubscribe link
2. User clicks unsubscribe (opens in new tab)
3. New tab loads API URL: /api/unsubscribe?email=x&tenant=y
4. Backend processes unsubscribe request
5. Backend returns 3xx redirect to frontend success page
6. User sees simple unsubscribe confirmation with basic messaging
```

### System Flow Diagram
```
Email Send Request → Check Unsubscribe Status → Send/Skip → Update Logs
                                ↓
SendGrid Webhook → Process Event → Update Unsubscribe Status
                                ↓
Unsubscribe Link Click (New Tab) → Record Unsubscribe → 3xx Redirect → FE Success Page
```

---

## 🗄️ Database Implementation

### 1. Update Schema File (Drizzle will auto-generate migration)

**File**: `server/src/db/schema.ts`

Add the new table definition:

```typescript
// Contact Unsubscribes table
export const contactUnsubscribes = appSchema.table(
  'contact_unsubscribes',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    channelValue: text('channel_value').notNull(),
    unsubscribedAt: timestamp('unsubscribed_at').notNull().defaultNow(),
    unsubscribeSource: text('unsubscribe_source').notNull(),
    campaignId: text('campaign_id').references(() => contactCampaigns.id, { onDelete: 'set null' }),
    contactId: text('contact_id').references(() => leadPointOfContacts.id, { onDelete: 'set null' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('contact_unsubscribes_unique').on(table.tenantId, table.channel, table.channelValue),
    index('contact_unsubscribes_tenant_channel_idx').on(table.tenantId, table.channel),
    index('contact_unsubscribes_channel_value_idx').on(table.channel, table.channelValue),
    index('contact_unsubscribes_unsubscribed_at_idx').on(table.unsubscribedAt),
    index('contact_unsubscribes_source_idx').on(table.unsubscribeSource),
  ]
);

// Relations
export const contactUnsubscribesRelations = relations(contactUnsubscribes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contactUnsubscribes.tenantId],
    references: [tenants.id],
  }),
  campaign: one(contactCampaigns, {
    fields: [contactUnsubscribes.campaignId],
    references: [contactCampaigns.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [contactUnsubscribes.contactId],
    references: [leadPointOfContacts.id],
  }),
}));

// Add to schema exports
export type ContactUnsubscribe = typeof contactUnsubscribes.$inferSelect;
export type NewContactUnsubscribe = typeof contactUnsubscribes.$inferInsert;
```

---

## 🔧 Backend Implementation

### 3. Create Repository

**File**: `server/src/repositories/entities/ContactUnsubscribeRepository.ts`

```typescript
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { contactUnsubscribes, type ContactUnsubscribe, type NewContactUnsubscribe } from '@/db/schema';
import { logger } from '@/libs/logger';

export class ContactUnsubscribeRepository {
  async createUnsubscribe(data: {
    tenantId: string;
    channel: string;
    channelValue: string;
    unsubscribeSource: string;
    campaignId?: string;
    contactId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ContactUnsubscribe> {
    const newUnsubscribe: NewContactUnsubscribe = {
      tenantId: data.tenantId,
      channel: data.channel,
      channelValue: data.channelValue.toLowerCase().trim(),
      unsubscribeSource: data.unsubscribeSource,
      campaignId: data.campaignId,
      contactId: data.contactId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    };

    try {
      const [result] = await db.insert(contactUnsubscribes).values(newUnsubscribe).returning();
      
      logger.info('Created unsubscribe record', {
        id: result.id,
        tenantId: data.tenantId,
        channel: data.channel,
        channelValue: data.channelValue,
        source: data.unsubscribeSource,
      });

      return result;
    } catch (error) {
      // Handle duplicate key constraint (already unsubscribed)
      if (error instanceof Error && error.message.includes('unique constraint')) {
        logger.info('Unsubscribe record already exists', {
          tenantId: data.tenantId,
          channel: data.channel,
          channelValue: data.channelValue,
        });
        
        // Return existing record
        const existing = await this.findByChannelValue(data.tenantId, data.channel, data.channelValue);
        if (existing) return existing;
      }
      
      logger.error('Failed to create unsubscribe record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
      });
      throw error;
    }
  }

  async findByChannelValue(
    tenantId: string,
    channel: string,
    channelValue: string
  ): Promise<ContactUnsubscribe | null> {
    const [result] = await db
      .select()
      .from(contactUnsubscribes)
      .where(
        and(
          eq(contactUnsubscribes.tenantId, tenantId),
          eq(contactUnsubscribes.channel, channel),
          eq(contactUnsubscribes.channelValue, channelValue.toLowerCase().trim())
        )
      )
      .limit(1);

    return result || null;
  }

  async findUnsubscribedChannelValues(
    tenantId: string,
    channel: string,
    channelValues: string[]
  ): Promise<ContactUnsubscribe[]> {
    if (channelValues.length === 0) return [];

    const normalizedValues = channelValues.map(v => v.toLowerCase().trim());

    return await db
      .select()
      .from(contactUnsubscribes)
      .where(
        and(
          eq(contactUnsubscribes.tenantId, tenantId),
          eq(contactUnsubscribes.channel, channel),
          inArray(contactUnsubscribes.channelValue, normalizedValues)
        )
      );
  }

  async findByTenantAndDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ContactUnsubscribe[]> {
    return await db
      .select()
      .from(contactUnsubscribes)
      .where(
        and(
          eq(contactUnsubscribes.tenantId, tenantId),
          and(
            eq(contactUnsubscribes.unsubscribedAt, startDate), // Use proper date comparison
            eq(contactUnsubscribes.unsubscribedAt, endDate)
          )
        )
      );
  }
}

export const contactUnsubscribeRepository = new ContactUnsubscribeRepository();
```

### 4. Create Unsubscribe Service

**File**: `server/src/modules/unsubscribe/unsubscribe.service.ts`

```typescript
import { contactUnsubscribeRepository } from '@/repositories/entities/ContactUnsubscribeRepository';
import { logger } from '@/libs/logger';

export class UnsubscribeService {
  async unsubscribeByChannel(
    tenantId: string,
    channel: string,
    channelValue: string,
    source: string,
    metadata?: {
      campaignId?: string;
      contactId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      await contactUnsubscribeRepository.createUnsubscribe({
        tenantId,
        channel,
        channelValue,
        unsubscribeSource: source,
        ...metadata,
      });

      logger.info('Successfully unsubscribed channel', {
        tenantId,
        channel,
        channelValue,
        source,
        metadata,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe channel', {
        tenantId,
        channel,
        channelValue,
        source,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async isChannelUnsubscribed(
    tenantId: string,
    channel: string,
    channelValue: string
  ): Promise<boolean> {
    try {
      const unsubscribe = await contactUnsubscribeRepository.findByChannelValue(
        tenantId,
        channel,
        channelValue
      );
      return !!unsubscribe;
    } catch (error) {
      logger.error('Failed to check unsubscribe status', {
        tenantId,
        channel,
        channelValue,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fail open - don't block emails on database errors
      return false;
    }
  }

  async getUnsubscribedChannelValues(
    tenantId: string,
    channel: string,
    channelValues: string[]
  ): Promise<Set<string>> {
    try {
      const unsubscribes = await contactUnsubscribeRepository.findUnsubscribedChannelValues(
        tenantId,
        channel,
        channelValues
      );

      return new Set(unsubscribes.map(u => u.channelValue));
    } catch (error) {
      logger.error('Failed to get unsubscribed channel values', {
        tenantId,
        channel,
        channelValuesCount: channelValues.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fail open - return empty set on errors
      return new Set();
    }
  }
}

export const unsubscribeService = new UnsubscribeService();
```

### 5. Update SendGrid Client

**File**: `server/src/libs/email/sendgrid.client.ts`

Add unsubscribe link injection:

```typescript
import { unsubscribeService } from '@/modules/unsubscribe/unsubscribe.service';

class SendgridClient {
  // ... existing code ...

  async sendEmail(input: SendBase): Promise<ProviderIds> {
    const body = input.html ?? input.text;
    if (!body) {
      throw new Error('Email body is required: provide html or text');
    }

    // Inject unsubscribe link if HTML content
    const finalHtml = input.html 
      ? this.appendUnsubscribeLink(input.html, input.tenantId, input.to, input.campaignId)
      : body;

    const msg: MailDataRequired = {
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: finalHtml,
      headers: input.headers,
      categories: input.categories,
      customArgs: this.buildCustomArgs(input),
      ...(input.asmGroupId ? { asm: { groupId: input.asmGroupId } } : {}),
    };

    const [resp] = await sgMail.send(msg, false);
    return this.extractProviderIds(resp);
  }

  private appendUnsubscribeLink(
    html: string,
    tenantId: string,
    toEmail: string,
    campaignId?: string
  ): string {
    const unsubscribeUrl = this.buildUnsubscribeUrl(tenantId, toEmail, campaignId);
    
    const unsubscribeLink = `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
        <p style="margin: 0;">
          If you no longer wish to receive these emails, you can 
          <a href="${unsubscribeUrl}" target="_blank" style="color: #666; text-decoration: underline;">unsubscribe here</a>.
        </p>
      </div>
    `;

    // Try to insert before closing body tag, otherwise append
    if (html.includes('</body>')) {
      return html.replace('</body>', `${unsubscribeLink}</body>`);
    } else {
      return html + unsubscribeLink;
    }
  }

  private buildUnsubscribeUrl(tenantId: string, email: string, campaignId?: string): string {
    const baseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      email: email.toLowerCase(),
      tenant: tenantId,
    });
    
    if (campaignId) {
      params.append('campaign', campaignId);
    }

    return `${baseUrl}/api/unsubscribe?${params.toString()}`;
  }

  // ... rest of existing code ...
}
```

### 6. Create Unsubscribe Routes

**File**: `server/src/routes/unsubscribe.routes.ts`

```typescript
import { FastifyPluginAsync } from 'fastify';
import { unsubscribeService } from '@/modules/unsubscribe/unsubscribe.service';
import { tenantRepository } from '@/repositories';
import { logger } from '@/libs/logger';

const unsubscribeRoutes: FastifyPluginAsync = async (fastify) => {
  // Unsubscribe endpoint
  fastify.get('/unsubscribe', async (request, reply) => {
    try {
      const { email, tenant, campaign } = request.query as {
        email?: string;
        tenant?: string;
        campaign?: string;
      };

      // Validate required parameters
      if (!email || !tenant) {
        return reply.status(400).send({ 
          error: 'Missing required parameters: email and tenant' 
        });
      }

      // Normalize email
      const normalizedEmail = email.toLowerCase().trim();
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return reply.status(400).send({ error: 'Invalid email format' });
      }

      // Optional: Validate tenant exists (security measure)
      try {
        const tenantExists = await tenantRepository.findById(tenant);
        if (!tenantExists) {
          logger.warn('Unsubscribe attempt with invalid tenant', {
            tenant,
            email: normalizedEmail,
            ip: request.ip,
          });
          return reply.status(404).send({ error: 'Invalid request' });
        }
      } catch (error) {
        logger.error('Error validating tenant for unsubscribe', {
          tenant,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with unsubscribe even if tenant validation fails
      }

      // Record the unsubscribe
      await unsubscribeService.unsubscribeByChannel(
        tenant,
        'email',
        normalizedEmail,
        'link_click',
        {
          campaignId: campaign,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        }
      );

      // Redirect to frontend success page
      const frontendUrl = process.env.UNSUBSCRIBE_FRONTEND_URL || 'http://localhost:5173/unsubscribe/success';
      const redirectUrl = `${frontendUrl}?email=${encodeURIComponent(normalizedEmail)}`;
      
      return reply.redirect(302, redirectUrl);

    } catch (error) {
      logger.error('Unsubscribe request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: request.query,
        ip: request.ip,
      });
      
      return reply.status(500).send({ error: 'Failed to process unsubscribe request' });
    }
  });

  // Optional: Manual unsubscribe API for admin use
  fastify.post('/unsubscribe', async (request, reply) => {
    try {
      const { email, tenantId, source = 'manual' } = request.body as {
        email: string;
        tenantId: string;
        source?: string;
      };

      if (!email || !tenantId) {
        return reply.status(400).send({ 
          error: 'Missing required fields: email and tenantId' 
        });
      }

      await unsubscribeService.unsubscribeByChannel(
        tenantId,
        'email',
        email.toLowerCase().trim(),
        source,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        }
      );

      return reply.send({ success: true, message: 'Successfully unsubscribed' });

    } catch (error) {
      logger.error('Manual unsubscribe failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: request.body,
      });
      
      return reply.status(500).send({ error: 'Failed to process unsubscribe' });
    }
  });
};

export default unsubscribeRoutes;
```

### 7. Register Routes

**File**: `server/src/routes/index.ts` (or your main route registration file)

```typescript
// Add to your route registration
import unsubscribeRoutes from './unsubscribe.routes';

// Register the routes
fastify.register(unsubscribeRoutes, { prefix: '/api' });
```

### 8. Update Campaign Execution Worker

**File**: `server/src/workers/campaign-execution/email-execution.service.ts`

Add unsubscribe check:

```typescript
import { unsubscribeService } from '@/modules/unsubscribe/unsubscribe.service';

export class EmailExecutionService {
  async executeEmailSend(params: EmailExecutionParams): Promise<EmailExecutionResult> {
    const { tenantId, campaignId, contactId, nodeId, node, contact } = params;

    try {
      // Validate that this is an email channel
      if (node.channel !== 'email') {
        throw new Error(`Invalid channel for email execution: ${node.channel}`);
      }

      // Validate required email content
      if (!node.subject || !node.body) {
        throw new Error('Email subject and body are required');
      }

      if (!contact.email) {
        throw new Error('Contact email is required');
      }

      // CHECK UNSUBSCRIBE STATUS FIRST
      const isUnsubscribed = await unsubscribeService.isChannelUnsubscribed(
        tenantId,
        'email',
        contact.email.toLowerCase()
      );

      if (isUnsubscribed) {
        logger.info('[EmailExecutionService] Skipping email send - contact unsubscribed', {
          tenantId,
          campaignId,
          contactId,
          nodeId,
          email: contact.email,
        });

        return {
          success: false,
          error: 'Contact has unsubscribed from emails',
          skipped: true,
          skipReason: 'unsubscribed',
        };
      }

      // Continue with existing email send logic...
      // ... rest of existing code remains the same ...

    } catch (error) {
      // ... existing error handling ...
    }
  }

  // ... rest of existing methods ...
}
```

Update the result interface:

```typescript
export interface EmailExecutionResult {
  success: boolean;
  outboundMessageId?: string;
  providerMessageId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}
```

### 9. Update SendGrid Webhook Service

**File**: `server/src/modules/webhooks/sendgrid.webhook.service.ts`

Add unsubscribe event handling:

```typescript
import { unsubscribeService } from '@/modules/unsubscribe/unsubscribe.service';

export class SendGridWebhookService {
  // ... existing code ...

  private async processEvents(
    tenantId: string,
    events: SendGridEvent[],
    processedAtTimestamp: string
  ): Promise<ProcessedEventResult[]> {
    const results: ProcessedEventResult[] = [];

    for (const event of events) {
      try {
        // Handle unsubscribe events
        if (event.event === 'unsubscribe' || event.event === 'group_unsubscribe') {
          await this.handleUnsubscribeEvent(event, tenantId);
        }

        // ... existing event processing logic ...

      } catch (error) {
        // ... existing error handling ...
      }
    }

    return results;
  }

  private async handleUnsubscribeEvent(
    event: SendGridEvent,
    tenantId: string
  ): Promise<void> {
    const email = (event as any).email?.toLowerCase();
    if (!email) {
      logger.warn('Unsubscribe event missing email address', { event });
      return;
    }

    try {
      await unsubscribeService.unsubscribeByChannel(
        tenantId,
        'email',
        email,
        'sendgrid_webhook',
        {
          campaignId: (event as any).sg_event_id,
        }
      );

      logger.info('Processed unsubscribe webhook event', {
        tenantId,
        email,
        eventType: event.event,
        eventId: (event as any).sg_event_id,
      });
    } catch (error) {
      logger.error('Failed to process unsubscribe webhook event', {
        tenantId,
        email,
        eventType: event.event,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // ... rest of existing code ...
}
```

---

## 🎨 Frontend Implementation

### 10. Create Unsubscribe Success Page

**File**: `client/src/pages/UnsubscribePage.tsx`

```tsx
import React from 'react';
import { useSearchParams } from 'react-router-dom';

export const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: 'white',
          fontSize: '24px'
        }}>
          ✓
        </div>
        
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 16px'
        }}>
          Successfully Unsubscribed
        </h1>
        
        {email && (
          <p style={{
            fontSize: '16px',
            color: '#6b7280',
            margin: '0 0 24px'
          }}>
            <strong>{email}</strong> has been removed from our email list.
          </p>
        )}
        
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          padding: '16px',
          textAlign: 'left',
          marginBottom: '24px'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#15803d',
            margin: '0 0 12px',
            fontWeight: '500'
          }}>
            You will no longer receive marketing emails from us.
          </p>
          <p style={{
            fontSize: '14px',
            color: '#15803d',
            margin: '0',
            lineHeight: '1.5'
          }}>
            Please note: You may still receive emails that were already scheduled before this request. 
            These should stop within 24-48 hours.
          </p>
        </div>
        
        <p style={{
          fontSize: '12px',
          color: '#9ca3af',
          margin: '0'
        }}>
          If you continue to receive emails after 48 hours, please contact our support team.
        </p>
      </div>
    </div>
  );
};

export default UnsubscribePage;
```

### 11. Add Route Configuration

**File**: `client/src/router.tsx`

```tsx
import { createBrowserRouter } from 'react-router-dom';
import UnsubscribePage from './pages/UnsubscribePage';

// Add to your existing routes
const router = createBrowserRouter([
  // ... existing routes ...
  
  {
    path: '/unsubscribe/success',
    element: <UnsubscribePage />,
  },
  
  // ... rest of routes ...
]);

export default router;
```

---

## 🔧 Configuration & Environment

### 12. Update Environment Variables

**File**: `server/.env` and `server/.example.env`

```bash
# Unsubscribe Configuration
UNSUBSCRIBE_FRONTEND_URL=http://localhost:5173/unsubscribe/success
SERVER_BASE_URL=http://localhost:3000

# Production values:
# UNSUBSCRIBE_FRONTEND_URL=https://yourapp.com/unsubscribe/success  
# SERVER_BASE_URL=https://api.yourapp.com
```

### 13. Update Repository Index

**File**: `server/src/repositories/index.ts`

```typescript
// Add the new repository export
export { contactUnsubscribeRepository } from './entities/ContactUnsubscribeRepository';
```

---

## 🧪 Testing Implementation

### 14. Unit Tests

**File**: `server/src/modules/unsubscribe/__tests__/unsubscribe.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnsubscribeService } from '../unsubscribe.service';
import { contactUnsubscribeRepository } from '@/repositories/entities/ContactUnsubscribeRepository';

jest.mock('@/repositories/entities/ContactUnsubscribeRepository');

describe('UnsubscribeService', () => {
  let service: UnsubscribeService;
  const mockRepository = contactUnsubscribeRepository as jest.Mocked<typeof contactUnsubscribeRepository>;

  beforeEach(() => {
    service = new UnsubscribeService();
    jest.clearAllMocks();
  });

  describe('unsubscribeByChannel', () => {
    it('should create unsubscribe record', async () => {
      const mockUnsubscribe = {
        id: 'test-id',
        tenantId: 'tenant-1',
        channel: 'email',
        channelValue: 'test@example.com',
        unsubscribeSource: 'link_click',
        unsubscribedAt: new Date(),
        createdAt: new Date(),
      };

      mockRepository.createUnsubscribe.mockResolvedValue(mockUnsubscribe as any);

      await service.unsubscribeByChannel('tenant-1', 'email', 'test@example.com', 'link_click');

      expect(mockRepository.createUnsubscribe).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        channel: 'email',
        channelValue: 'test@example.com',
        unsubscribeSource: 'link_click',
      });
    });
  });

  describe('isChannelUnsubscribed', () => {
    it('should return true when unsubscribe record exists', async () => {
      mockRepository.findByChannelValue.mockResolvedValue({} as any);

      const result = await service.isChannelUnsubscribed('tenant-1', 'email', 'test@example.com');

      expect(result).toBe(true);
      expect(mockRepository.findByChannelValue).toHaveBeenCalledWith('tenant-1', 'email', 'test@example.com');
    });

    it('should return false when no unsubscribe record exists', async () => {
      mockRepository.findByChannelValue.mockResolvedValue(null);

      const result = await service.isChannelUnsubscribed('tenant-1', 'email', 'test@example.com');

      expect(result).toBe(false);
    });
  });
});
```

### 15. Integration Tests

**File**: `server/src/routes/__tests__/unsubscribe.routes.test.ts`

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildTestApp } from '@/test-utils/app';

describe('Unsubscribe Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  describe('GET /api/unsubscribe', () => {
    it('should redirect to success page with valid parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unsubscribe?email=test@example.com&tenant=tenant-1',
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain('unsubscribe/success');
      expect(response.headers.location).toContain('test@example.com');
    });

    it('should return 400 for missing parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unsubscribe?email=test@example.com', // Missing tenant
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required parameters');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unsubscribe?email=invalid-email&tenant=tenant-1',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid email format');
    });
  });
});
```

---

## 🚀 Deployment & Monitoring

### 16. Generate and Run Database Migration

After updating the schema, generate the migration:

```bash
# Generate migration from schema changes
npm run db:migrate:new

# Apply the migration
npm run db:migrate

# Production
npm run db:migrate:production
```

### 17. Monitoring & Logging

Add monitoring for:
- Unsubscribe rates by tenant
- Failed unsubscribe attempts
- Email send skip rates due to unsubscribes

**File**: `server/src/modules/analytics/unsubscribe.analytics.ts`

```typescript
import { contactUnsubscribeRepository } from '@/repositories/entities/ContactUnsubscribeRepository';
import { logger } from '@/libs/logger';

export class UnsubscribeAnalytics {
  async getUnsubscribeStats(tenantId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const unsubscribes = await contactUnsubscribeRepository.findByTenantAndDateRange(
        tenantId,
        startDate,
        new Date()
      );

      const stats = {
        total: unsubscribes.length,
        bySource: unsubscribes.reduce((acc, u) => {
          acc[u.unsubscribeSource] = (acc[u.unsubscribeSource] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byDay: this.groupByDay(unsubscribes),
      };

      logger.info('Generated unsubscribe stats', { tenantId, days, stats });
      return stats;
      
    } catch (error) {
      logger.error('Failed to generate unsubscribe stats', {
        tenantId,
        days,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private groupByDay(unsubscribes: any[]) {
    // Implementation for daily grouping
    return unsubscribes.reduce((acc, u) => {
      const day = u.unsubscribedAt.toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
```

---

## ✅ Pre-Deployment Checklist

### Database
- [ ] Migration file created and tested
- [ ] Schema updated with new table and relations
- [ ] Indexes added for performance
- [ ] Unique constraints properly configured

### Backend
- [ ] Repository implemented with all CRUD operations
- [ ] Service layer with proper error handling
- [ ] Routes created with validation and rate limiting
- [ ] SendGrid client updated to inject unsubscribe links
- [ ] Campaign worker updated to check unsubscribe status
- [ ] Webhook service updated to handle unsubscribe events
- [ ] Environment variables configured

### Frontend
- [ ] Unsubscribe success page created
- [ ] Routes configured
- [ ] Responsive design implemented
- [ ] Error states handled

### Testing
- [ ] Unit tests for service and repository
- [ ] Integration tests for API routes
- [ ] End-to-end testing of unsubscribe flow
- [ ] Email rendering tests with unsubscribe links

### Security & Compliance
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Proper error handling that doesn't leak sensitive info
- [ ] Logging configured for audit trail
- [ ] GDPR/CAN-SPAM compliance verified

### Monitoring
- [ ] Analytics for unsubscribe rates
- [ ] Error tracking and alerting
- [ ] Performance monitoring
- [ ] Database query optimization

---

## 🔄 Rollback Plan

If issues arise during deployment:

1. **Database**: Keep migration reversible
2. **Feature Flag**: Implement feature flag for unsubscribe link injection
3. **Gradual Rollout**: Deploy to staging first, then production with monitoring
4. **Monitoring**: Set up alerts for unusual unsubscribe patterns or errors

---

## 📈 Success Metrics

- [ ] All emails include unsubscribe links
- [ ] Unsubscribe requests are processed successfully
- [ ] Campaign workers respect unsubscribe status
- [ ] No performance degradation in email sending
- [ ] Webhook events processed correctly
- [ ] Frontend page loads and functions properly
- [ ] Zero data loss or corruption
- [ ] Compliance with email regulations maintained