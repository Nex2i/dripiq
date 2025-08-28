import { relations } from 'drizzle-orm';
import {
  text,
  timestamp,
  boolean,
  unique,
  pgSchema,
  vector,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { DATABASE_SCHEMA } from '../config';
import { DEFAULT_CALENDAR_TIE_IN } from '../constants';

// Define the custom schema
export const appSchema = pgSchema(DATABASE_SCHEMA);

// Users table
export const users = appSchema.table('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  supabaseId: text('supabase_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  calendarLink: text('calendar_link'),
  calendarTieIn: text('calendar_tie_in').notNull().default(DEFAULT_CALENDAR_TIE_IN),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tenants table
export const tenants = appSchema.table('tenants', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  organizationName: text('organization_name'),
  website: text('organization_website'),
  summary: text('organization_summary'),
  differentiators: jsonb('differentiators'), // Array of differentiators the company has
  targetMarket: text('target_market'), // The target market the company is trying to serve
  tone: text('tone'), // The tone of the company
  brandColors: jsonb('brand_colors'), // Array of hex color codes representing the brand color palette
  siteEmbeddingDomainId: text('site_embedding_domain_id').references(
    () => siteEmbeddingDomains.id,
    { onDelete: 'set null' }
  ),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Products table
export const products = appSchema.table('products', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text('title').notNull(),
  description: text('description'),
  salesVoice: text('sales_voice'),
  siteUrl: text('site_url'), // Optional site URL for the product
  isDefault: boolean('is_default').notNull().default(false),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Roles table
export const roles = appSchema.table('roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Permissions table
export const permissions = appSchema.table('permissions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  description: text('description'),
  resource: text('resource').notNull(), // e.g., 'campaigns', 'users', 'leads'
  action: text('action').notNull(), // e.g., 'create', 'read', 'update', 'delete', 'manage'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Role-Permission relationship table
export const rolePermissions = appSchema.table(
  'role_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [unique('role_permission_unique').on(table.roleId, table.permissionId)]
);

// User-Tenant relationship table (consolidated with invite functionality)
export const userTenants = appSchema.table(
  'user_tenants',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    isSuperUser: boolean('is_super_user').notNull().default(false),
    status: text('status').notNull().default('active'), // 'pending' (password not set) | 'active' (password set, can login)
    invitedAt: timestamp('invited_at'), // When the user was invited/added
    acceptedAt: timestamp('accepted_at'), // When they completed setup/login
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('user_tenant_unique').on(table.userId, table.tenantId)]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tenants: many(userTenants),
}));

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  users: many(userTenants),
  leads: many(leads),
  products: many(products),
  siteEmbeddingDomain: one(siteEmbeddingDomains, {
    fields: [tenants.siteEmbeddingDomainId],
    references: [siteEmbeddingDomains.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  userTenants: many(userTenants),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userTenantsRelations = relations(userTenants, ({ one }) => ({
  user: one(users, {
    fields: [userTenants.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [userTenants.tenantId],
    references: [tenants.id],
  }),
  role: one(roles, {
    fields: [userTenants.roleId],
    references: [roles.id],
  }),
}));

// Leads table
export const leads = appSchema.table('leads', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  url: text('url').notNull(),
  status: text('status').notNull().default('new'),
  summary: text('summary'),
  products: jsonb('products'), // Array of products the company offers
  services: jsonb('services'), // Array of services the company offers
  differentiators: jsonb('differentiators'), // Array of differentiators the company has
  targetMarket: text('target_market'), // The target market the company is trying to serve
  tone: text('tone'), // The tone of the company
  brandColors: jsonb('brand_colors'), // Array of hex color codes representing the brand color palette
  primaryContactId: text('primary_contact_id'), // Reference to primary contact (nullable)
  ownerId: text('owner_id').references(() => users.id, { onDelete: 'set null' }), // Reference to lead owner (nullable)
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  siteEmbeddingDomainId: text('site_embedding_domain_id').references(
    () => siteEmbeddingDomains.id,
    { onDelete: 'set null' }
  ),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Lead Point of Contacts table
export const leadPointOfContacts = appSchema.table('lead_point_of_contacts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  leadId: text('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'), // Made nullable to allow contacts without email
  phone: text('phone'),
  title: text('title'), // Job title
  company: text('company'),
  sourceUrl: text('source_url'), // URL where the contact information was found
  manuallyReviewed: boolean('manually_reviewed').notNull().default(false), // Whether the contact has been manually reviewed
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Lead Statuses table
export const leadStatuses = appSchema.table(
  'lead_statuses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('lead_status_unique').on(table.leadId, table.status)]
);

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [leads.ownerId],
    references: [users.id],
  }),
  siteEmbeddingDomain: one(siteEmbeddingDomains, {
    fields: [leads.siteEmbeddingDomainId],
    references: [siteEmbeddingDomains.id],
  }),
  pointOfContacts: many(leadPointOfContacts),
  statuses: many(leadStatuses),
  primaryContact: one(leadPointOfContacts, {
    fields: [leads.primaryContactId],
    references: [leadPointOfContacts.id],
  }),
  leadProducts: many(leadProducts),
}));

export const leadPointOfContactsRelations = relations(leadPointOfContacts, ({ one }) => ({
  lead: one(leads, {
    fields: [leadPointOfContacts.leadId],
    references: [leads.id],
  }),
}));

export const leadStatusesRelations = relations(leadStatuses, ({ one }) => ({
  lead: one(leads, {
    fields: [leadStatuses.leadId],
    references: [leads.id],
  }),
  tenant: one(tenants, {
    fields: [leadStatuses.tenantId],
    references: [tenants.id],
  }),
}));

// Site embedding domains table - stores domain/page metadata (1-to-many with embeddings)
export const siteEmbeddingDomains = appSchema.table(
  'site_embedding_domains',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    domain: text('domain').notNull().unique(), // e.g., "google OR facebook" - Unique provides index
    scrapedAt: timestamp('scraped_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('site_scraped_at_idx').on(table.scrapedAt)]
);

// Site embeddings table - stores embeddings that belong to domains
export const siteEmbeddings = appSchema.table(
  'site_embeddings',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    domainId: text('domain_id')
      .notNull()
      .references(() => siteEmbeddingDomains.id, { onDelete: 'cascade' }),
    url: text('url').notNull(), // Full URL of the page where embeddings came from
    slug: text('slug').notNull(), // Slug of the page where embeddings came from
    title: text('title'), // Page title
    content: text('content').notNull(), // Original text content
    contentSummary: text('content_summary'), // Optional summarized content
    chunkIndex: integer('chunk_index'), // Order/position within the page (0-based)
    embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embedding vector
    tokenCount: integer('token_count'), // Number of tokens in the content
    metadata: jsonb('metadata'), // Additional flexible metadata (e.g., section type, headers)
    firecrawlId: text('firecrawl_id'), // Firecrawl job ID
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('domain_embeddings_idx').on(table.domainId, table.chunkIndex),
    index('site_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')), // HNSW index for vector similarity search (requires pgvector)
    index('site_embedding_token_count_idx').on(table.tokenCount),
    index('site_embedding_content_idx').on(table.content),
  ]
);

// Relations for scraping tables
export const siteEmbeddingDomainsRelations = relations(siteEmbeddingDomains, ({ many }) => ({
  embeddings: many(siteEmbeddings),
}));

export const siteEmbeddingsRelations = relations(siteEmbeddings, ({ one }) => ({
  domain: one(siteEmbeddingDomains, {
    fields: [siteEmbeddings.domainId],
    references: [siteEmbeddingDomains.id],
  }),
}));

// Lead Products junction table (many-to-many relationship)
export const leadProducts = appSchema.table(
  'lead_products',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attachedAt: timestamp('attached_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('lead_products_lead_id_product_id_unique').on(table.leadId, table.productId)]
);

// Relations for lead products junction table
export const leadProductsRelations = relations(leadProducts, ({ one }) => ({
  lead: one(leads, {
    fields: [leadProducts.leadId],
    references: [leads.id],
  }),
  product: one(products, {
    fields: [leadProducts.productId],
    references: [products.id],
  }),
}));

// Relations for products table
export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [products.tenantId],
    references: [tenants.id],
  }),
  leadProducts: many(leadProducts),
}));

// Email Sender Identities table - AE sender verification
export const emailSenderIdentities = appSchema.table(
  'email_sender_identities',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fromEmail: text('from_email').notNull(),
    fromName: text('from_name').notNull(),
    domain: text('domain').notNull(),
    sendgridSenderId: text('sendgrid_sender_id'),
    validationStatus: text('validation_status').notNull().default('pending'), // pending|verified|failed
    lastValidatedAt: timestamp('last_validated_at'),
    dedicatedIpPool: text('dedicated_ip_pool'),
    emailSignature: text('email_signature'), // HTML email signature
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique('tenant_email_unique').on(table.tenantId, table.fromEmail)]
);

// Enums for Contact Campaigns
// Note: Use 'campaign_channel' to align with DB enum created in migrations
export const channelEnum = appSchema.enum('campaign_channel', ['email', 'sms']);
export const campaignStatusEnum = appSchema.enum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed',
  'stopped',
  'error',
]);
export const scheduledActionStatusEnum = appSchema.enum('scheduled_action_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'canceled',
]);
export const outboundMessageStateEnum = appSchema.enum('outbound_message_state', [
  'queued',
  'scheduled',
  'sent',
  'failed',
  'canceled',
]);

// Contact Campaigns table - core campaign instances
export const contactCampaigns = appSchema.table(
  'contact_campaigns',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => leadPointOfContacts.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    status: campaignStatusEnum('status').notNull().default('draft'),
    currentNodeId: text('current_node_id'),
    planJson: jsonb('plan_json').notNull(),
    planVersion: text('plan_version').notNull().default('1.0'),
    planHash: text('plan_hash').notNull(), // for idempotency
    senderIdentityId: text('sender_identity_id').references(() => emailSenderIdentities.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('contact_channel_unique').on(table.tenantId, table.contactId, table.channel),
    index('contact_campaigns_status_idx').on(table.tenantId, table.status),
    index('contact_campaigns_plan_hash_idx').on(table.planHash),
    index('contact_campaigns_plan_json_gin_idx').using('gin', table.planJson),
  ]
);

// Campaign Plan Versions - plan audit trail
export const campaignPlanVersions = appSchema.table(
  'campaign_plan_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => contactCampaigns.id, { onDelete: 'cascade' }),
    version: text('version').notNull(),
    planJson: jsonb('plan_json').notNull(),
    planHash: text('plan_hash').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('campaign_version_unique').on(table.campaignId, table.version),
    index('campaign_plan_versions_hash_idx').on(table.planHash),
    index('campaign_plan_versions_plan_json_gin_idx').using('gin', table.planJson),
  ]
);

// Scheduled Actions - SQL-based job scheduling
export const scheduledActions = appSchema.table(
  'scheduled_actions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id').references(() => contactCampaigns.id, { onDelete: 'cascade' }),
    actionType: text('action_type').notNull(),
    scheduledAt: timestamp('scheduled_at').notNull(),
    status: scheduledActionStatusEnum('status').notNull().default('pending'),
    payload: jsonb('payload'),
    bullmqJobId: text('bullmq_job_id'), // Track BullMQ job ID for cancellation
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('scheduled_actions_tenant_status_idx').on(table.tenantId, table.status),
    index('scheduled_actions_scheduled_at_idx').on(table.scheduledAt),
  ]
);

// Outbound Messages - outbox and deduplication
export const outboundMessages = appSchema.table(
  'outbound_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => contactCampaigns.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => leadPointOfContacts.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    senderIdentityId: text('sender_identity_id').references(() => emailSenderIdentities.id, {
      onDelete: 'set null',
    }),
    providerMessageId: text('provider_message_id'),
    dedupeKey: text('dedupe_key').notNull(),
    content: jsonb('content'),
    state: outboundMessageStateEnum('state').notNull().default('queued'),
    scheduledAt: timestamp('scheduled_at'),
    sentAt: timestamp('sent_at'),
    errorAt: timestamp('error_at'),
    lastError: text('last_error'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('outbound_messages_dedupe_unique').on(table.tenantId, table.dedupeKey),
    index('outbound_messages_state_idx').on(table.tenantId, table.state),
    index('outbound_messages_provider_id_idx').on(table.providerMessageId),
  ]
);

// Message Events - normalized engagement events
export const messageEvents = appSchema.table(
  'message_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    messageId: text('message_id')
      .notNull()
      .references(() => outboundMessages.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // delivered|open|click|bounce|spam|unsubscribe|reply
    eventAt: timestamp('event_at').notNull(),
    sgEventId: text('sg_event_id'), // SendGrid's unique event identifier for efficient duplicate detection
    data: jsonb('data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('message_events_tenant_type_idx').on(table.tenantId, table.type),
    index('message_events_event_at_idx').on(table.eventAt),
    index('message_events_sg_event_id_idx').on(table.sgEventId),
  ]
);

// Webhook Deliveries - raw webhook archive
export const webhookDeliveries = appSchema.table(
  'webhook_deliveries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // sendgrid|twilio|...
    eventType: text('event_type').notNull(),
    messageId: text('message_id').references(() => outboundMessages.id, { onDelete: 'set null' }),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
    payload: jsonb('payload').notNull(),
    signature: text('signature'),
    status: text('status').notNull().default('received'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('webhook_deliveries_provider_idx').on(table.tenantId, table.provider),
    index('webhook_deliveries_received_at_idx').on(table.receivedAt),
  ]
);

// Inbound Messages - reply storage for analysis
export const inboundMessages = appSchema.table(
  'inbound_messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id').references(() => contactCampaigns.id, { onDelete: 'set null' }),
    contactId: text('contact_id').references(() => leadPointOfContacts.id, {
      onDelete: 'set null',
    }),
    channel: channelEnum('channel').notNull(),
    providerMessageId: text('provider_message_id'),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
    subject: text('subject'),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('inbound_messages_received_at_idx').on(table.receivedAt),
    index('inbound_messages_provider_id_idx').on(table.providerMessageId),
  ]
);

// Communication Suppressions - per-tenant suppression lists
export const communicationSuppressions = appSchema.table(
  'communication_suppressions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    address: text('address').notNull(),
    reason: text('reason'),
    suppressedAt: timestamp('suppressed_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('communication_suppressions_unique').on(table.tenantId, table.channel, table.address),
    index('communication_suppressions_suppressed_at_idx').on(table.suppressedAt),
  ]
);

// Send Rate Limits - configurable sending limits
export const sendRateLimits = appSchema.table(
  'send_rate_limits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    scope: text('scope').notNull().default('tenant'), // tenant|identity
    identityId: text('identity_id').references(() => emailSenderIdentities.id, {
      onDelete: 'set null',
    }),
    windowSeconds: integer('window_seconds').notNull(),
    maxSends: integer('max_sends').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('send_rate_limits_unique').on(
      table.tenantId,
      table.channel,
      table.scope,
      table.identityId
    ),
    index('send_rate_limits_channel_idx').on(table.channel),
  ]
);

// Email Validation Results - SendGrid validation cache
export const emailValidationResults = appSchema.table(
  'email_validation_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    isValid: boolean('is_valid').notNull().default(false),
    score: integer('score'),
    validationStatus: text('validation_status'),
    source: text('source'),
    checkedAt: timestamp('checked_at'),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('email_validation_results_unique').on(table.tenantId, table.email),
    index('email_validation_results_checked_at_idx').on(table.checkedAt),
  ]
);

// Contact Channels - multi-address support (optional)
export const contactChannels = appSchema.table(
  'contact_channels',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => leadPointOfContacts.id, { onDelete: 'cascade' }),
    type: channelEnum('type').notNull(),
    value: text('value').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    isVerified: boolean('is_verified').notNull().default(false),
    verificationStatus: text('verification_status'),
    verifiedAt: timestamp('verified_at'),
    validationResultId: text('validation_result_id').references(() => emailValidationResults.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('contact_channels_unique').on(table.tenantId, table.contactId, table.type, table.value),
    index('contact_channels_primary_idx').on(table.isPrimary),
  ]
);

// Campaign Transitions - state change audit log
export const campaignTransitions = appSchema.table(
  'campaign_transitions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => contactCampaigns.id, { onDelete: 'cascade' }),
    fromStatus: campaignStatusEnum('from_status'),
    toStatus: campaignStatusEnum('to_status').notNull(),
    reason: text('reason'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('campaign_transitions_campaign_idx').on(table.campaignId, table.occurredAt)]
);

// Contact Unsubscribes - channel-based unsubscribe tracking
export const contactUnsubscribes = appSchema.table(
  'contact_unsubscribes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(), // 'email', 'sms', etc.
    channelValue: text('channel_value').notNull(), // email address, phone number, etc. (normalized/lowercase)
    unsubscribedAt: timestamp('unsubscribed_at').notNull().defaultNow(),
    unsubscribeSource: text('unsubscribe_source').notNull(), // 'link_click', 'sendgrid_webhook', 'manual'
    campaignId: text('campaign_id').references(() => contactCampaigns.id, { onDelete: 'set null' }),
    contactId: text('contact_id').references(() => leadPointOfContacts.id, {
      onDelete: 'set null',
    }), // Optional context
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

// Domain Validation - pre-approved domains for automatic sender verification
export const domainValidation = appSchema.table(
  'domain_validation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    domain: text('domain').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('domain_validation_domain_idx').on(table.domain)]
);

// Calendar Link Clicks - track clicks on calendar links in emails
export const calendarLinkClicks = appSchema.table(
  'calendar_link_clicks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    leadId: text('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => leadPointOfContacts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    campaignId: text('campaign_id'), // Optional - from email context
    nodeId: text('node_id'), // Optional - from email context
    outboundMessageId: text('outbound_message_id'), // Optional - from email context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    referrer: text('referrer'),
    clickedAt: timestamp('clicked_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('calendar_link_clicks_tenant_id_idx').on(table.tenantId),
    index('calendar_link_clicks_lead_id_idx').on(table.leadId),
    index('calendar_link_clicks_contact_id_idx').on(table.contactId),
    index('calendar_link_clicks_user_id_idx').on(table.userId),
    index('calendar_link_clicks_clicked_at_idx').on(table.clickedAt),
  ]
);

// Relations for new tables
export const emailSenderIdentitiesRelations = relations(emailSenderIdentities, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [emailSenderIdentities.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [emailSenderIdentities.userId],
    references: [users.id],
  }),
  outboundMessages: many(outboundMessages),
}));

export const contactCampaignsRelations = relations(contactCampaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contactCampaigns.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [contactCampaigns.leadId],
    references: [leads.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [contactCampaigns.contactId],
    references: [leadPointOfContacts.id],
  }),
  senderIdentity: one(emailSenderIdentities, {
    fields: [contactCampaigns.senderIdentityId],
    references: [emailSenderIdentities.id],
  }),
  scheduledActions: many(scheduledActions),
  outboundMessages: many(outboundMessages),
  transitions: many(campaignTransitions),
  inboundMessages: many(inboundMessages),
  planVersions: many(campaignPlanVersions),
}));

export const campaignPlanVersionsRelations = relations(campaignPlanVersions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [campaignPlanVersions.tenantId],
    references: [tenants.id],
  }),
  campaign: one(contactCampaigns, {
    fields: [campaignPlanVersions.campaignId],
    references: [contactCampaigns.id],
  }),
  createdBy: one(users, {
    fields: [campaignPlanVersions.createdBy],
    references: [users.id],
  }),
}));

export const scheduledActionsRelations = relations(scheduledActions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [scheduledActions.tenantId],
    references: [tenants.id],
  }),
  campaign: one(contactCampaigns, {
    fields: [scheduledActions.campaignId],
    references: [contactCampaigns.id],
  }),
}));

export const outboundMessagesRelations = relations(outboundMessages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [outboundMessages.tenantId],
    references: [tenants.id],
  }),
  campaign: one(contactCampaigns, {
    fields: [outboundMessages.campaignId],
    references: [contactCampaigns.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [outboundMessages.contactId],
    references: [leadPointOfContacts.id],
  }),
  senderIdentity: one(emailSenderIdentities, {
    fields: [outboundMessages.senderIdentityId],
    references: [emailSenderIdentities.id],
  }),
  events: many(messageEvents),
}));

export const messageEventsRelations = relations(messageEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messageEvents.tenantId],
    references: [tenants.id],
  }),
  message: one(outboundMessages, {
    fields: [messageEvents.messageId],
    references: [outboundMessages.id],
  }),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookDeliveries.tenantId],
    references: [tenants.id],
  }),
  message: one(outboundMessages, {
    fields: [webhookDeliveries.messageId],
    references: [outboundMessages.id],
  }),
}));

export const inboundMessagesRelations = relations(inboundMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inboundMessages.tenantId],
    references: [tenants.id],
  }),
  campaign: one(contactCampaigns, {
    fields: [inboundMessages.campaignId],
    references: [contactCampaigns.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [inboundMessages.contactId],
    references: [leadPointOfContacts.id],
  }),
}));

export const communicationSuppressionsRelations = relations(
  communicationSuppressions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [communicationSuppressions.tenantId],
      references: [tenants.id],
    }),
  })
);

export const sendRateLimitsRelations = relations(sendRateLimits, ({ one }) => ({
  tenant: one(tenants, {
    fields: [sendRateLimits.tenantId],
    references: [tenants.id],
  }),
  identity: one(emailSenderIdentities, {
    fields: [sendRateLimits.identityId],
    references: [emailSenderIdentities.id],
  }),
}));

export const emailValidationResultsRelations = relations(emailValidationResults, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailValidationResults.tenantId],
    references: [tenants.id],
  }),
}));

export const contactChannelsRelations = relations(contactChannels, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contactChannels.tenantId],
    references: [tenants.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [contactChannels.contactId],
    references: [leadPointOfContacts.id],
  }),
  validationResult: one(emailValidationResults, {
    fields: [contactChannels.validationResultId],
    references: [emailValidationResults.id],
  }),
}));

export const campaignTransitionsRelations = relations(campaignTransitions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [campaignTransitions.tenantId],
    references: [tenants.id],
  }),
  campaign: one(contactCampaigns, {
    fields: [campaignTransitions.campaignId],
    references: [contactCampaigns.id],
  }),
  createdBy: one(users, {
    fields: [campaignTransitions.createdBy],
    references: [users.id],
  }),
}));

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

export const domainValidationRelations = relations(domainValidation, ({}) => ({}));

export const calendarLinkClicksRelations = relations(calendarLinkClicks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [calendarLinkClicks.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [calendarLinkClicks.leadId],
    references: [leads.id],
  }),
  contact: one(leadPointOfContacts, {
    fields: [calendarLinkClicks.contactId],
    references: [leadPointOfContacts.id],
  }),
  user: one(users, {
    fields: [calendarLinkClicks.userId],
    references: [users.id],
  }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type UserTenant = typeof userTenants.$inferSelect;
export type NewUserTenant = typeof userTenants.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadPointOfContact = typeof leadPointOfContacts.$inferSelect;
export type NewLeadPointOfContact = typeof leadPointOfContacts.$inferInsert;
export type LeadStatus = typeof leadStatuses.$inferSelect;
export type NewLeadStatus = typeof leadStatuses.$inferInsert;
export type SiteEmbedding = typeof siteEmbeddings.$inferSelect;
export type NewSiteEmbedding = typeof siteEmbeddings.$inferInsert;
export type SiteEmbeddingDomain = typeof siteEmbeddingDomains.$inferSelect;
export type NewSiteEmbeddingDomain = typeof siteEmbeddingDomains.$inferInsert;
export type LeadProduct = typeof leadProducts.$inferSelect;
export type NewLeadProduct = typeof leadProducts.$inferInsert;
export type EmailSenderIdentity = typeof emailSenderIdentities.$inferSelect;
export type NewEmailSenderIdentity = typeof emailSenderIdentities.$inferInsert;
export type ContactCampaign = typeof contactCampaigns.$inferSelect;
export type NewContactCampaign = typeof contactCampaigns.$inferInsert;
export type CampaignPlanVersion = typeof campaignPlanVersions.$inferSelect;
export type NewCampaignPlanVersion = typeof campaignPlanVersions.$inferInsert;
export type ScheduledAction = typeof scheduledActions.$inferSelect;
export type NewScheduledAction = typeof scheduledActions.$inferInsert;
export type OutboundMessage = typeof outboundMessages.$inferSelect;
export type NewOutboundMessage = typeof outboundMessages.$inferInsert;
export type MessageEvent = typeof messageEvents.$inferSelect;
export type NewMessageEvent = typeof messageEvents.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type NewInboundMessage = typeof inboundMessages.$inferInsert;
export type CommunicationSuppression = typeof communicationSuppressions.$inferSelect;
export type NewCommunicationSuppression = typeof communicationSuppressions.$inferInsert;
export type SendRateLimit = typeof sendRateLimits.$inferSelect;
export type NewSendRateLimit = typeof sendRateLimits.$inferInsert;
export type EmailValidationResult = typeof emailValidationResults.$inferSelect;
export type NewEmailValidationResult = typeof emailValidationResults.$inferInsert;
export type ContactChannel = typeof contactChannels.$inferSelect;
export type NewContactChannel = typeof contactChannels.$inferInsert;
export type CampaignTransition = typeof campaignTransitions.$inferSelect;
export type NewCampaignTransition = typeof campaignTransitions.$inferInsert;
export type ContactUnsubscribe = typeof contactUnsubscribes.$inferSelect;
export type NewContactUnsubscribe = typeof contactUnsubscribes.$inferInsert;
export type DomainValidation = typeof domainValidation.$inferSelect;
export type NewDomainValidation = typeof domainValidation.$inferInsert;
export type CalendarLinkClick = typeof calendarLinkClicks.$inferSelect;
export type NewCalendarLinkClick = typeof calendarLinkClicks.$inferInsert;
