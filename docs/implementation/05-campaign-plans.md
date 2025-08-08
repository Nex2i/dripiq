# Ticket 05: Campaign Plans Management

**Epic**: Core Campaign Engine (Phase 2)  
**Story Points**: 6  
**Priority**: Critical  
**Dependencies**: 01-database-schema, 04-sender-identities

## Objective

Implement campaign plan storage and management system using JSON DSL to define campaign behavior, AI-generated plan storage, versioning, and validation. Plans define the complete flow of touchpoints and reactive logic for each contact.

## Acceptance Criteria

- [ ] JSON schema validation for campaign plans
- [ ] Plan creation and storage in `contact_campaigns` table
- [ ] Plan versioning and audit trail
- [ ] AI integration for plan generation (interface only)
- [ ] Plan validation and error handling
- [ ] Template variable support for personalization
- [ ] Plan import/export functionality

## Technical Requirements

### Campaign Plan JSON Structure

```json
{
  "version": "1.0",
  "timezone": "America/Los_Angeles", 
  "quietHours": { "start": "21:00", "end": "07:30" },
  "nodes": [
    {
      "id": "email_intro",
      "channel": "email",
      "action": "send",
      "subject": "Hello {contact.name}",
      "body": "Hi {contact.name}, I noticed {lead.name}...",
      "schedule": { "delay": "PT0S" },
      "transitions": [
        { "on": "opened", "to": "wait_click", "within": "PT72H" },
        { "on": "no_open", "to": "email_followup", "after": "PT72H" }
      ]
    }
  ],
  "startNodeId": "email_intro"
}
```

## Implementation Steps

### Step 1: Plan Schema Validation

Create `server/src/libs/campaigns/plan.validator.ts`:

```typescript
import { z } from 'zod';

// ISO 8601 duration pattern (PT72H, PT30M, etc.)
const durationSchema = z.string().regex(/^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/);

const transitionSchema = z.object({
  on: z.enum(['opened', 'clicked', 'bounced', 'unsubscribed', 'delivered', 'no_open', 'no_click']),
  to: z.string(), // Node ID or 'stop'
  within: durationSchema.optional(),
  after: durationSchema.optional(),
});

const nodeSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(['email', 'sms']),
  action: z.enum(['send', 'wait']),
  subject: z.string().optional(),
  body: z.string().optional(),
  schedule: z.object({
    delay: durationSchema.default('PT0S'),
  }).optional(),
  transitions: z.array(transitionSchema).default([]),
  senderIdentityId: z.string().optional(),
});

const quietHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const campaignPlanSchema = z.object({
  version: z.string().default('1.0'),
  timezone: z.string().default('UTC'),
  quietHours: quietHoursSchema.optional(),
  nodes: z.array(nodeSchema).min(1),
  startNodeId: z.string(),
}).refine((plan) => {
  // Validate startNodeId exists in nodes
  return plan.nodes.some(node => node.id === plan.startNodeId);
}, {
  message: 'startNodeId must reference an existing node',
  path: ['startNodeId'],
}).refine((plan) => {
  // Validate all transition targets exist
  const nodeIds = new Set(plan.nodes.map(n => n.id));
  nodeIds.add('stop'); // Allow 'stop' as terminal state
  
  for (const node of plan.nodes) {
    for (const transition of node.transitions) {
      if (!nodeIds.has(transition.to)) {
        return false;
      }
    }
  }
  return true;
}, {
  message: 'All transition targets must reference existing nodes or "stop"',
});

export type CampaignPlan = z.infer<typeof campaignPlanSchema>;

export function validateCampaignPlan(plan: unknown): { valid: boolean; plan?: CampaignPlan; errors?: string[] } {
  try {
    const validatedPlan = campaignPlanSchema.parse(plan);
    return { valid: true, plan: validatedPlan };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      valid: false,
      errors: ['Invalid plan structure'],
    };
  }
}
```

### Step 2: Campaign Plan Service

Create `server/src/services/campaigns/plan.service.ts`:

```typescript
import { db } from '../../db';
import { contactCampaigns, campaignPlanVersions, leadPointOfContacts, leads } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { validateCampaignPlan, CampaignPlan } from '../../libs/campaigns/plan.validator';
import { logger } from '../../libs/logger';
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';

export interface CreateCampaignPlanRequest {
  contactId: string;
  channel: 'email' | 'sms';
  plan: unknown; // Will be validated
  senderIdentityId?: string;
  generatedBy?: 'ai' | 'manual';
  notes?: string;
}

export interface CampaignPlanInfo {
  id: string;
  contactId: string;
  leadId: string;
  channel: string;
  status: string;
  currentNodeId?: string;
  plan: CampaignPlan;
  planVersion: string;
  planHash: string;
  senderIdentityId?: string;
  startedAt?: Date;
  completedAt?: Date;
  contact: {
    name: string;
    email?: string;
    title?: string;
  };
  lead: {
    name: string;
    url: string;
    summary?: string;
  };
}

export class CampaignPlanService {

  async createCampaignPlan(
    tenantId: string,
    request: CreateCampaignPlanRequest
  ): Promise<CampaignPlanInfo> {
    
    // Validate the plan structure
    const validation = validateCampaignPlan(request.plan);
    if (!validation.valid) {
      throw new Error(`Invalid campaign plan: ${validation.errors?.join(', ')}`);
    }

    const plan = validation.plan!;

    // Load contact and lead data for context
    const [contactData] = await db
      .select({
        contact: leadPointOfContacts,
        lead: leads,
      })
      .from(leadPointOfContacts)
      .innerJoin(leads, eq(leadPointOfContacts.leadId, leads.id))
      .where(
        and(
          eq(leadPointOfContacts.id, request.contactId),
          eq(leads.tenantId, tenantId)
        )
      );

    if (!contactData) {
      throw new Error(`Contact not found: ${request.contactId}`);
    }

    // Check if campaign already exists for this contact/channel
    const [existing] = await db
      .select()
      .from(contactCampaigns)
      .where(
        and(
          eq(contactCampaigns.tenantId, tenantId),
          eq(contactCampaigns.contactId, request.contactId),
          eq(contactCampaigns.channel, request.channel)
        )
      );

    if (existing) {
      throw new Error(`Campaign already exists for contact ${request.contactId} on ${request.channel}`);
    }

    // Generate plan hash for idempotency
    const planHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(plan))
      .digest('hex');

    const campaignId = createId();
    
    try {
      await db.transaction(async (tx) => {
        // Create campaign record
        await tx.insert(contactCampaigns).values({
          id: campaignId,
          tenantId,
          leadId: contactData.lead.id,
          contactId: request.contactId,
          channel: request.channel,
          status: 'draft',
          currentNodeId: null, // Will be set when campaign starts
          planJson: plan,
          planVersion: '1.0',
          planHash,
          senderIdentityId: request.senderIdentityId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create plan version record for audit
        await tx.insert(campaignPlanVersions).values({
          id: createId(),
          tenantId,
          contactCampaignId: campaignId,
          version: '1.0',
          planJson: plan,
          generatedBy: request.generatedBy || 'manual',
          notes: request.notes,
          createdAt: new Date(),
        });
      });

      logger.info('Campaign plan created', {
        campaignId,
        tenantId,
        contactId: request.contactId,
        channel: request.channel,
        nodeCount: plan.nodes.length,
        planHash: planHash.substring(0, 8),
      });

      return {
        id: campaignId,
        contactId: request.contactId,
        leadId: contactData.lead.id,
        channel: request.channel,
        status: 'draft',
        plan,
        planVersion: '1.0',
        planHash,
        senderIdentityId: request.senderIdentityId,
        contact: {
          name: contactData.contact.name,
          email: contactData.contact.email || undefined,
          title: contactData.contact.title || undefined,
        },
        lead: {
          name: contactData.lead.name,
          url: contactData.lead.url,
          summary: contactData.lead.summary || undefined,
        },
      };

    } catch (error) {
      logger.error('Failed to create campaign plan', {
        tenantId,
        contactId: request.contactId,
        error: error.message,
      });
      throw error;
    }
  }

  async getCampaignPlan(
    tenantId: string,
    campaignId: string
  ): Promise<CampaignPlanInfo | null> {
    
    const [result] = await db
      .select({
        campaign: contactCampaigns,
        contact: leadPointOfContacts,
        lead: leads,
      })
      .from(contactCampaigns)
      .innerJoin(leadPointOfContacts, eq(contactCampaigns.contactId, leadPointOfContacts.id))
      .innerJoin(leads, eq(contactCampaigns.leadId, leads.id))
      .where(
        and(
          eq(contactCampaigns.id, campaignId),
          eq(contactCampaigns.tenantId, tenantId)
        )
      );

    if (!result) {
      return null;
    }

    return {
      id: result.campaign.id,
      contactId: result.campaign.contactId,
      leadId: result.campaign.leadId,
      channel: result.campaign.channel,
      status: result.campaign.status,
      currentNodeId: result.campaign.currentNodeId || undefined,
      plan: result.campaign.planJson as CampaignPlan,
      planVersion: result.campaign.planVersion,
      planHash: result.campaign.planHash,
      senderIdentityId: result.campaign.senderIdentityId || undefined,
      startedAt: result.campaign.startedAt || undefined,
      completedAt: result.campaign.completedAt || undefined,
      contact: {
        name: result.contact.name,
        email: result.contact.email || undefined,
        title: result.contact.title || undefined,
      },
      lead: {
        name: result.lead.name,
        url: result.lead.url,
        summary: result.lead.summary || undefined,
      },
    };
  }

  async updateCampaignPlan(
    tenantId: string,
    campaignId: string,
    newPlan: unknown,
    notes?: string
  ): Promise<CampaignPlanInfo> {
    
    // Validate new plan
    const validation = validateCampaignPlan(newPlan);
    if (!validation.valid) {
      throw new Error(`Invalid campaign plan: ${validation.errors?.join(', ')}`);
    }

    const plan = validation.plan!;

    // Check if campaign exists and is in draft state
    const existing = await this.getCampaignPlan(tenantId, campaignId);
    if (!existing) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    if (existing.status !== 'draft') {
      throw new Error(`Cannot update plan for ${existing.status} campaign`);
    }

    // Generate new plan hash
    const planHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(plan))
      .digest('hex');

    // Get next version number
    const [versionResult] = await db
      .select({ maxVersion: sql<string>`MAX(version)` })
      .from(campaignPlanVersions)
      .where(eq(campaignPlanVersions.contactCampaignId, campaignId));

    const nextVersion = this.incrementVersion(versionResult?.maxVersion || '1.0');

    try {
      await db.transaction(async (tx) => {
        // Update campaign
        await tx
          .update(contactCampaigns)
          .set({
            planJson: plan,
            planVersion: nextVersion,
            planHash,
            updatedAt: new Date(),
          })
          .where(eq(contactCampaigns.id, campaignId));

        // Create new version record
        await tx.insert(campaignPlanVersions).values({
          id: createId(),
          tenantId,
          contactCampaignId: campaignId,
          version: nextVersion,
          planJson: plan,
          generatedBy: 'manual',
          notes: notes || `Updated to version ${nextVersion}`,
          createdAt: new Date(),
        });
      });

      logger.info('Campaign plan updated', {
        campaignId,
        newVersion: nextVersion,
        planHash: planHash.substring(0, 8),
      });

      // Return updated campaign info
      return await this.getCampaignPlan(tenantId, campaignId)!;

    } catch (error) {
      logger.error('Failed to update campaign plan', {
        campaignId,
        error: error.message,
      });
      throw error;
    }
  }

  async getCampaignPlansForTenant(
    tenantId: string,
    filters?: {
      status?: string;
      channel?: string;
      leadId?: string;
    }
  ): Promise<CampaignPlanInfo[]> {
    
    let query = db
      .select({
        campaign: contactCampaigns,
        contact: leadPointOfContacts,
        lead: leads,
      })
      .from(contactCampaigns)
      .innerJoin(leadPointOfContacts, eq(contactCampaigns.contactId, leadPointOfContacts.id))
      .innerJoin(leads, eq(contactCampaigns.leadId, leads.id))
      .where(eq(contactCampaigns.tenantId, tenantId));

    // Apply filters
    if (filters?.status) {
      query = query.where(eq(contactCampaigns.status, filters.status));
    }
    if (filters?.channel) {
      query = query.where(eq(contactCampaigns.channel, filters.channel));
    }
    if (filters?.leadId) {
      query = query.where(eq(contactCampaigns.leadId, filters.leadId));
    }

    const results = await query.orderBy(contactCampaigns.createdAt);

    return results.map(result => ({
      id: result.campaign.id,
      contactId: result.campaign.contactId,
      leadId: result.campaign.leadId,
      channel: result.campaign.channel,
      status: result.campaign.status,
      currentNodeId: result.campaign.currentNodeId || undefined,
      plan: result.campaign.planJson as CampaignPlan,
      planVersion: result.campaign.planVersion,
      planHash: result.campaign.planHash,
      senderIdentityId: result.campaign.senderIdentityId || undefined,
      startedAt: result.campaign.startedAt || undefined,
      completedAt: result.campaign.completedAt || undefined,
      contact: {
        name: result.contact.name,
        email: result.contact.email || undefined,
        title: result.contact.title || undefined,
      },
      lead: {
        name: result.lead.name,
        url: result.lead.url,
        summary: result.lead.summary || undefined,
      },
    }));
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[parts.length - 1] || '0');
    parts[parts.length - 1] = (patch + 1).toString();
    return parts.join('.');
  }
}

export const campaignPlanService = new CampaignPlanService();
```

### Step 3: Template Variable Support

Create `server/src/libs/campaigns/template.renderer.ts`:

```typescript
export interface TemplateContext {
  contact: {
    name: string;
    email?: string;
    title?: string;
    company?: string;
  };
  lead: {
    name: string;
    url: string;
    summary?: string;
    targetMarket?: string;
  };
  tenant: {
    name: string;
    organizationName?: string;
  };
  sender: {
    name: string;
    email: string;
  };
}

export class TemplateRenderer {
  
  static render(template: string, context: TemplateContext): string {
    let rendered = template;

    // Replace variables with format {object.property}
    rendered = rendered.replace(/\{([^}]+)\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });

    return rendered;
  }

  static validateTemplate(template: string): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const variablePattern = /\{([^}]+)\}/g;
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const path = match[1];
      if (!this.isValidPath(path)) {
        errors.push(`Invalid template variable: {${path}}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  private static isValidPath(path: string): boolean {
    const validPaths = [
      'contact.name', 'contact.email', 'contact.title', 'contact.company',
      'lead.name', 'lead.url', 'lead.summary', 'lead.targetMarket',
      'tenant.name', 'tenant.organizationName',
      'sender.name', 'sender.email',
    ];
    
    return validPaths.includes(path);
  }
}
```

### Step 4: API Routes

Create `server/src/routes/campaigns/plans.routes.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import { campaignPlanService } from '../../services/campaigns/plan.service';

export async function campaignPlanRoutes(fastify: FastifyInstance) {
  
  // Create new campaign plan
  fastify.post('/campaigns/plans', {
    schema: {
      body: {
        type: 'object',
        required: ['contactId', 'channel', 'plan'],
        properties: {
          contactId: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'sms'] },
          plan: { type: 'object' },
          senderIdentityId: { type: 'string' },
          generatedBy: { type: 'string', enum: ['ai', 'manual'] },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const body = request.body as any;

    try {
      const campaignPlan = await campaignPlanService.createCampaignPlan(tenantId, body);
      return reply.status(201).send(campaignPlan);
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get campaign plan by ID
  fastify.get('/campaigns/plans/:campaignId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          campaignId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { campaignId } = request.params as { campaignId: string };

    try {
      const campaignPlan = await campaignPlanService.getCampaignPlan(tenantId, campaignId);
      
      if (!campaignPlan) {
        return reply.status(404).send({ error: 'Campaign plan not found' });
      }

      return reply.send(campaignPlan);
    } catch (error) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Update campaign plan
  fastify.put('/campaigns/plans/:campaignId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          campaignId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['plan'],
        properties: {
          plan: { type: 'object' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const { campaignId } = request.params as { campaignId: string };
    const { plan, notes } = request.body as any;

    try {
      const updatedPlan = await campaignPlanService.updateCampaignPlan(
        tenantId, 
        campaignId, 
        plan, 
        notes
      );
      
      return reply.send(updatedPlan);
    } catch (error) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // List campaign plans with filters
  fastify.get('/campaigns/plans', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'sms'] },
          leadId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const tenantId = request.user.tenantId;
    const filters = request.query as any;

    try {
      const plans = await campaignPlanService.getCampaignPlansForTenant(tenantId, filters);
      return reply.send({ plans });
    } catch (error) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
```

## File Structure

```
server/src/
├── libs/
│   └── campaigns/
│       ├── plan.validator.ts        # JSON schema validation
│       └── template.renderer.ts     # Variable substitution
├── services/
│   └── campaigns/
│       └── plan.service.ts          # Core plan management
└── routes/
    └── campaigns/
        └── plans.routes.ts          # API endpoints
```

## Testing Requirements

No unit tests at this time.

## Performance Considerations

### Plan Storage
- Store plans as JSONB for efficient querying
- Index on plan_hash for duplicate detection
- GIN index on plan_json for complex queries

### Validation
- Cache validated schemas
- Validate templates at creation time
- Pre-compile complex validation rules

## Definition of Done

- [ ] Campaign plan validation working with comprehensive schema
- [ ] Plan creation and storage implemented
- [ ] Plan versioning and audit trail functional
- [ ] Template variable support implemented
- [ ] API endpoints for plan management
- [ ] Integration with sender identities
- [ ] Documentation and examples
