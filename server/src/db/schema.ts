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
  isActive: boolean('is_active').notNull().default(true),
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

// Roles table
export const roles = appSchema.table('roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  isSystemRole: boolean('is_system_role').notNull().default(false),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
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
  resource: text('resource').notNull(), // e.g., 'users', 'tenants', 'roles'
  action: text('action').notNull(), // e.g., 'create', 'read', 'update', 'delete', 'invite'
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
  (table) => ({
    rolePermissionUnique: unique().on(table.roleId, table.permissionId),
  })
);

// User-Tenant-Role relationship table (updated from userTenants)
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
    isSuperUser: boolean('is_super_user').notNull().default(false), // Keep for backward compatibility
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
  roles: many(roles),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [roles.tenantId],
    references: [tenants.id],
  }),
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

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserTenant = typeof userTenants.$inferSelect;
export type NewUserTenant = typeof userTenants.$inferInsert;
