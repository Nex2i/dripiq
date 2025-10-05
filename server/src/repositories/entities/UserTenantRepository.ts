import { eq, and } from 'drizzle-orm';
import {
  userTenants,
  UserTenant,
  NewUserTenant,
  users,
  tenants,
  roles,
  User,
  Tenant,
} from '@/db/schema';
import { NotFoundError } from '@/exceptions/error';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export interface UserTenantWithDetails extends UserTenant {
  user?: User;
  tenant?: Tenant;
  role?: {
    id: string;
    name: string;
    description: string | null;
  };
}

export class UserTenantRepository extends TenantAwareRepository<
  typeof userTenants,
  UserTenant,
  NewUserTenant
> {
  constructor() {
    super(userTenants);
  }

  /**
   * Find user-tenant relationships by user ID for tenant
   */
  async findByUserIdForTenant(userId: string, tenantId: string): Promise<UserTenant> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.tenantId, tenantId)))
      .limit(1);

    if (!results[0]) {
      throw new NotFoundError(`User ${userId} not found in tenant ${tenantId}`);
    }

    return results[0];
  }

  /**
   * Find pending user-tenant relationship by user ID
   */
  async findPendingByUserId(userId: string, tenantId?: string): Promise<UserTenant> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.status, 'pending')));

    if (!results[0]) {
      throw new NotFoundError(`User ${userId} has no pending user-tenant relationship`);
    }

    if (!tenantId) {
      return results[0];
    }

    const tenantSpecific = results.filter((result) => result.tenantId === tenantId)[0];
    if (!tenantSpecific) {
      throw new NotFoundError(
        `User ${userId} has no pending user-tenant relationship in tenant ${tenantId}`
      );
    }
    return tenantSpecific;
  }

  /**
   * Find all tenants for a user
   */
  async findTenantsByUserId(
    userId: string
  ): Promise<({ userTenant: UserTenant } & { tenant: Tenant })[]> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id));

    if (!results[0]) {
      throw new NotFoundError(`User ${userId} has no tenants`);
    }

    return results.map((result) => ({
      userTenant: result.user_tenants,
      tenant: result.tenants,
    }));
  }

  /**
   * Find all users for a tenant with details
   */
  async findUsersWithDetailsForTenant(tenantId: string): Promise<UserTenantWithDetails[]> {
    return (await this.db
      .select({
        id: this.table.id,
        userId: this.table.userId,
        tenantId: this.table.tenantId,
        roleId: this.table.roleId,
        isSuperUser: this.table.isSuperUser,
        status: this.table.status,
        invitedAt: this.table.invitedAt,
        acceptedAt: this.table.acceptedAt,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatar: users.avatar,
        },
        tenant: {
          id: tenants.id,
          name: tenants.name,
          organizationName: tenants.organizationName,
        },
        role: {
          id: roles.id,
          name: roles.name,
          description: roles.description,
        },
      })
      .from(this.table)
      .innerJoin(users, eq(this.table.userId, users.id))
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id))
      .innerJoin(roles, eq(this.table.roleId, roles.id))
      .where(eq(this.table.tenantId, tenantId))) as UserTenantWithDetails[];
  }

  /**
   * Update user status for tenant
   */
  async updateStatusForTenant(
    userId: string,
    tenantId: string,
    status: 'pending' | 'active' | 'deactivated'
  ): Promise<UserTenant | undefined> {
    const [result] = await this.db
      .update(this.table)
      .set({ status })
      .where(and(eq(this.table.userId, userId), eq(this.table.tenantId, tenantId)))
      .returning();

    return result as UserTenant;
  }

  /**
   * Update user role for tenant
   */
  async updateRoleForTenant(
    userId: string,
    tenantId: string,
    roleId: string
  ): Promise<UserTenant | undefined> {
    return await this.updateByIdForTenant(userId, tenantId, { roleId });
  }

  /**
   * Returns boolean if a user already exists in the tenant with the same email
   */
  async userExistsInTenant(email: string, tenantId: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(this.table)
      .innerJoin(users, eq(this.table.userId, users.id))
      .where(and(eq(this.table.tenantId, tenantId), eq(users.email, email)))
      .limit(1);

    return result.length > 0;
  }
}
