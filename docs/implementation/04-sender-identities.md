# Ticket 04: Sender Identities Management

**Epic**: Foundation (Phase 1)  
**Story Points**: 6  
**Priority**: Critical  
**Dependencies**: 01-database-schema, 03-sendgrid-integration

## Objective

Implement per-AE (Account Executive) sender identity management with SendGrid domain authentication, verification workflow, and enforcement policies. Each sales rep will have their own verified sender identity for personalized outreach.

## Acceptance Criteria

- [ ] Sender identity creation and management API
- [ ] SendGrid sender verification integration
- [ ] Default sender identity per tenant/user
- [ ] Verification status enforcement in send worker
- [ ] Sender identity selection in campaign plans
- [ ] Admin interface for identity management
- [ ] Automatic re-verification workflow

## Technical Requirements

### Core Features

1. **Identity Creation**: Register new sender identities with SendGrid
2. **Verification Workflow**: Handle SendGrid verification process
3. **Status Management**: Track verification status and updates
4. **Send Enforcement**: Only allow sends from verified identities
5. **Default Selection**: Auto-select appropriate sender per campaign

## Implementation Steps

### Step 1: Sender Identity Service

Create `server/src/services/sender.identity.service.ts`:

```typescript
import { db } from '../db';
import { emailSenderIdentities, users, tenants } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendgridClient } from '../libs/sendgrid/client';
import { logger } from '../libs/logger';
import { createId } from '@paralleldrive/cuid2';

export interface CreateSenderIdentityRequest {
  userId: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  isDefault?: boolean;
}

export interface SenderIdentityStatus {
  id: string;
  fromEmail: string;
  fromName: string;
  status: 'pending' | 'verified' | 'failed';
  sendgridSenderId?: string;
  lastValidatedAt?: Date;
  isDefault: boolean;
}

export class SenderIdentityService {

  async createSenderIdentity(
    tenantId: string,
    request: CreateSenderIdentityRequest
  ): Promise<SenderIdentityStatus> {
    
    // Validate user belongs to tenant
    const [userTenant] = await db
      .select()
      .from(users)
      .innerJoin(userTenants, eq(users.id, userTenants.userId))
      .where(
        and(
          eq(users.id, request.userId),
          eq(userTenants.tenantId, tenantId)
        )
      );

    if (!userTenant) {
      throw new Error(`User ${request.userId} not found in tenant ${tenantId}`);
    }

    // Extract domain from email
    const domain = request.fromEmail.split('@')[1];
    if (!domain) {
      throw new Error('Invalid email format');
    }

    // Check if identity already exists
    const [existing] = await db
      .select()
      .from(emailSenderIdentities)
      .where(
        and(
          eq(emailSenderIdentities.tenantId, tenantId),
          eq(emailSenderIdentities.fromEmail, request.fromEmail)
        )
      );

    if (existing) {
      throw new Error(`Sender identity already exists for ${request.fromEmail}`);
    }

    try {
      // Create sender identity in SendGrid
      const sendgridSender = await this.createSendGridSender({
        nickname: `${request.fromName} <${request.fromEmail}>`,
        from: {
          email: request.fromEmail,
          name: request.fromName,
        },
        reply_to: {
          email: request.replyTo || request.fromEmail,
          name: request.fromName,
        },
      });

      // If this is the first identity for user, make it default
      let isDefault = request.isDefault || false;
      const [existingCount] = await db
        .select({ count: count() })
        .from(emailSenderIdentities)
        .where(
          and(
            eq(emailSenderIdentities.tenantId, tenantId),
            eq(emailSenderIdentities.userId, request.userId)
          )
        );

      if (existingCount.count === 0) {
        isDefault = true;
      }

      // Store in database
      const identityId = createId();
      await db.insert(emailSenderIdentities).values({
        id: identityId,
        tenantId,
        userId: request.userId,
        fromEmail: request.fromEmail,
        fromName: request.fromName,
        domain,
        sendgridSenderId: sendgridSender.id,
        validationStatus: 'pending',
        isDefault,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      logger.info('Sender identity created', {
        identityId,
        tenantId,
        userId: request.userId,
        fromEmail: request.fromEmail,
        sendgridSenderId: sendgridSender.id,
      });

      return {
        id: identityId,
        fromEmail: request.fromEmail,
        fromName: request.fromName,
        status: 'pending',
        sendgridSenderId: sendgridSender.id,
        isDefault,
      };

    } catch (error) {
      logger.error('Failed to create sender identity', {
        tenantId,
        fromEmail: request.fromEmail,
        error: error.message,
      });
      throw error;
    }
  }

  async verifySenderIdentity(
    tenantId: string,
    identityId: string
  ): Promise<{ verified: boolean; status: string }> {
    
    const [identity] = await db
      .select()
      .from(emailSenderIdentities)
      .where(
        and(
          eq(emailSenderIdentities.id, identityId),
          eq(emailSenderIdentities.tenantId, tenantId)
        )
      );

    if (!identity) {
      throw new Error(`Sender identity not found: ${identityId}`);
    }

    if (!identity.sendgridSenderId) {
      throw new Error('SendGrid sender ID not found');
    }

    try {
      // Check verification status with SendGrid
      const sendgridStatus = await this.getSendGridSenderStatus(identity.sendgridSenderId);
      
      const newStatus = sendgridStatus.verified ? 'verified' : 
                       sendgridStatus.verification_status === 'failed' ? 'failed' : 'pending';

      // Update database
      await db
        .update(emailSenderIdentities)
        .set({
          validationStatus: newStatus,
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(emailSenderIdentities.id, identityId));

      logger.info('Sender identity verification updated', {
        identityId,
        status: newStatus,
        sendgridStatus: sendgridStatus.verification_status,
      });

      return {
        verified: newStatus === 'verified',
        status: newStatus,
      };

    } catch (error) {
      logger.error('Failed to verify sender identity', {
        identityId,
        error: error.message,
      });
      throw error;
    }
  }

  async getSenderIdentitiesForTenant(tenantId: string): Promise<SenderIdentityStatus[]> {
    const identities = await db
      .select({
        id: emailSenderIdentities.id,
        fromEmail: emailSenderIdentities.fromEmail,
        fromName: emailSenderIdentities.fromName,
        status: emailSenderIdentities.validationStatus,
        sendgridSenderId: emailSenderIdentities.sendgridSenderId,
        lastValidatedAt: emailSenderIdentities.lastValidatedAt,
        isDefault: emailSenderIdentities.isDefault,
        userId: emailSenderIdentities.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(emailSenderIdentities)
      .innerJoin(users, eq(emailSenderIdentities.userId, users.id))
      .where(eq(emailSenderIdentities.tenantId, tenantId))
      .orderBy(emailSenderIdentities.createdAt);

    return identities.map(identity => ({
      id: identity.id,
      fromEmail: identity.fromEmail,
      fromName: identity.fromName,
      status: identity.status as 'pending' | 'verified' | 'failed',
      sendgridSenderId: identity.sendgridSenderId || undefined,
      lastValidatedAt: identity.lastValidatedAt || undefined,
      isDefault: identity.isDefault,
      user: {
        id: identity.userId,
        name: identity.userName,
        email: identity.userEmail,
      },
    }));
  }

  async setDefaultSenderIdentity(
    tenantId: string,
    userId: string,
    identityId: string
  ): Promise<void> {
    
    await db.transaction(async (tx) => {
      // Remove default flag from all user's identities
      await tx
        .update(emailSenderIdentities)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(emailSenderIdentities.tenantId, tenantId),
            eq(emailSenderIdentities.userId, userId)
          )
        );

      // Set new default
      await tx
        .update(emailSenderIdentities)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(
          and(
            eq(emailSenderIdentities.id, identityId),
            eq(emailSenderIdentities.tenantId, tenantId),
            eq(emailSenderIdentities.userId, userId)
          )
        );
    });

    logger.info('Default sender identity updated', {
      tenantId,
      userId,
      identityId,
    });
  }

  async getDefaultSenderIdentity(
    tenantId: string,
    userId: string
  ): Promise<SenderIdentityStatus | null> {
    
    const [identity] = await db
      .select()
      .from(emailSenderIdentities)
      .where(
        and(
          eq(emailSenderIdentities.tenantId, tenantId),
          eq(emailSenderIdentities.userId, userId),
          eq(emailSenderIdentities.isDefault, true),
          eq(emailSenderIdentities.validationStatus, 'verified')
        )
      );

    if (!identity) {
      return null;
    }

    return {
      id: identity.id,
      fromEmail: identity.fromEmail,
      fromName: identity.fromName,
      status: identity.validationStatus as 'verified',
      sendgridSenderId: identity.sendgridSenderId || undefined,
      lastValidatedAt: identity.lastValidatedAt || undefined,
      isDefault: identity.isDefault,
    };
  }

  private async createSendGridSender(senderData: any): Promise<any> {
    try {
      const request = {
        url: '/v3/senders',
        method: 'POST' as const,
        body: senderData,
      };

      const [response] = await sendgridClient.request(request);
      return response.body;
    } catch (error) {
      throw new Error(`SendGrid sender creation failed: ${error.message}`);
    }
  }

  private async getSendGridSenderStatus(senderId: string): Promise<any> {
    try {
      const request = {
        url: `/v3/senders/${senderId}`,
        method: 'GET' as const,
      };

      const [response] = await sendgridClient.request(request);
      return response.body;
    } catch (error) {
      throw new Error(`SendGrid sender status check failed: ${error.message}`);
    }
  }

  async refreshAllPendingVerifications(tenantId: string): Promise<number> {
    const pendingIdentities = await db
      .select()
      .from(emailSenderIdentities)
      .where(
        and(
          eq(emailSenderIdentities.tenantId, tenantId),
          eq(emailSenderIdentities.validationStatus, 'pending')
        )
      );

    let updated = 0;
    for (const identity of pendingIdentities) {
      try {
        await this.verifySenderIdentity(tenantId, identity.id);
        updated++;
      } catch (error) {
        logger.warn('Failed to refresh sender identity verification', {
          identityId: identity.id,
          error: error.message,
        });
      }
    }

    logger.info('Refreshed pending sender verifications', {
      tenantId,
      checked: pendingIdentities.length,
      updated,
    });

    return updated;
  }
}

export const senderIdentityService = new SenderIdentityService();
```

### Step 2: API Routes

Create `server/src/routes/sender.identity.routes.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { senderIdentityService } from '../services/sender.identity.service';

export async function senderIdentityRoutes(fastify: FastifyInstance) {
  
  // Create new sender identity
  fastify.post('/sender-identities', {
    schema: {
      body: {
        type: 'object',
        required: ['userId', 'fromEmail', 'fromName'],
        properties: {
          userId: { type: 'string' },
          fromEmail: { type: 'string', format: 'email' },
          fromName: { type: 'string' },
          replyTo: { type: 'string', format: 'email' },
          isDefault: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const body = request.body as any;

    try {
      const identity = await senderIdentityService.createSenderIdentity(tenantId, body);
      return reply.status(201).send(identity);
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get all sender identities for tenant
  fastify.get('/sender-identities', async (request, reply) => {
    const tenantId = request.user.tenantId;

    try {
      const identities = await senderIdentityService.getSenderIdentitiesForTenant(tenantId);
      return reply.send({ identities });
    } catch (error) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Verify specific sender identity
  fastify.post('/sender-identities/:identityId/verify', {
    schema: {
      params: {
        type: 'object',
        properties: {
          identityId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { identityId } = request.params as { identityId: string };

    try {
      const result = await senderIdentityService.verifySenderIdentity(tenantId, identityId);
      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Set default sender identity for user
  fastify.post('/sender-identities/:identityId/set-default', {
    schema: {
      params: {
        type: 'object',
        properties: {
          identityId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const userId = request.user.id;
    const { identityId } = request.params as { identityId: string };

    try {
      await senderIdentityService.setDefaultSenderIdentity(tenantId, userId, identityId);
      return reply.send({ success: true });
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Refresh all pending verifications
  fastify.post('/sender-identities/refresh', async (request, reply) => {
    const tenantId = request.user.tenantId;

    try {
      const updated = await senderIdentityService.refreshAllPendingVerifications(tenantId);
      return reply.send({ updated });
    } catch (error) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Get user's default sender identity
  fastify.get('/users/:userId/default-sender', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { userId } = request.params as { userId: string };

    try {
      const identity = await senderIdentityService.getDefaultSenderIdentity(tenantId, userId);
      return reply.send({ identity });
    } catch (error) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
```

### Step 3: Validation Helpers

Create `server/src/libs/sender.validation.ts`:

```typescript
import { db } from '../db';
import { emailSenderIdentities } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export async function validateSenderIdentity(
  tenantId: string,
  senderIdentityId: string
): Promise<{ valid: boolean; identity?: any; error?: string }> {
  
  const [identity] = await db
    .select()
    .from(emailSenderIdentities)
    .where(
      and(
        eq(emailSenderIdentities.id, senderIdentityId),
        eq(emailSenderIdentities.tenantId, tenantId)
      )
    );

  if (!identity) {
    return {
      valid: false,
      error: `Sender identity not found: ${senderIdentityId}`,
    };
  }

  if (identity.validationStatus !== 'verified') {
    return {
      valid: false,
      error: `Sender identity not verified: ${identity.fromEmail} (status: ${identity.validationStatus})`,
    };
  }

  return {
    valid: true,
    identity,
  };
}

export async function getVerifiedSenderIdentities(tenantId: string) {
  return await db
    .select()
    .from(emailSenderIdentities)
    .where(
      and(
        eq(emailSenderIdentities.tenantId, tenantId),
        eq(emailSenderIdentities.validationStatus, 'verified')
      )
    );
}
```

### Step 4: Background Verification Job

Create `server/src/jobs/sender.verification.job.ts`:

```typescript
import { senderIdentityService } from '../services/sender.identity.service';
import { db } from '../db';
import { tenants } from '../db/schema';
import { logger } from '../libs/logger';

export async function refreshSenderVerifications() {
  logger.info('Starting sender verification refresh job');

  try {
    // Get all tenants
    const allTenants = await db.select({ id: tenants.id }).from(tenants);

    let totalUpdated = 0;
    for (const tenant of allTenants) {
      try {
        const updated = await senderIdentityService.refreshAllPendingVerifications(tenant.id);
        totalUpdated += updated;
      } catch (error) {
        logger.error('Failed to refresh verifications for tenant', {
          tenantId: tenant.id,
          error: error.message,
        });
      }
    }

    logger.info('Sender verification refresh completed', {
      tenantsProcessed: allTenants.length,
      totalUpdated,
    });

  } catch (error) {
    logger.error('Sender verification refresh job failed', {
      error: error.message,
    });
  }
}

// Run every hour
export const VERIFICATION_JOB_SCHEDULE = '0 * * * *'; // Cron: every hour
```

## File Structure

```
server/src/
├── services/
│   └── sender.identity.service.ts   # Core sender identity logic
├── routes/
│   └── sender.identity.routes.ts    # API endpoints
├── libs/
│   └── sender.validation.ts         # Validation helpers
├── jobs/
│   └── sender.verification.job.ts   # Background verification
└── middleware/
    └── sender.enforcement.ts        # Send-time validation
```

## Testing Requirements

No unit tests at this time.

## Security Considerations

### Domain Verification
- Only allow senders from verified domains
- Validate email format and domain existence
- Prevent spoofing with proper authentication

### Access Control
- Users can only manage their own identities
- Admins can view all tenant identities
- Verification status enforced at send time

## Performance Considerations

### Caching
- Cache verified identities in Redis
- Refresh verification status hourly
- Avoid excessive SendGrid API calls

### Database Optimization
- Index on tenant_id + user_id
- Index on validation_status for filtering
- Composite index for default identity lookup

## Definition of Done

- [ ] Sender identity creation API working
- [ ] SendGrid integration for verification
- [ ] Default identity management
- [ ] Verification status enforcement
- [ ] Background verification refresh job
- [ ] API routes for identity management
- [ ] Documentation updated