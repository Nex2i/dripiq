import { relations } from 'drizzle-orm';
import { text, timestamp, boolean, unique, pgSchema } from 'drizzle-orm/pg-core';
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// User-Tenant relationship table
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
    isSuperUser: boolean('is_super_user').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userTenantUnique: unique().on(table.userId, table.tenantId),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tenants: many(userTenants),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(userTenants),
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
}));

// Leads table
export const leads = appSchema.table('leads', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  email: text('email').notNull(),
  company: text('company'),
  phone: text('phone'),
  status: text('status').notNull().default('new'),
  tenantId: text('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type UserTenant = typeof userTenants.$inferSelect;
export type NewUserTenant = typeof userTenants.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
