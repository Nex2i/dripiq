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
