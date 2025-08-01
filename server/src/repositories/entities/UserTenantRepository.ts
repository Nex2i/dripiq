import { eq, and } from 'drizzle-orm';
import { TenantAwareRepository } from '../base/TenantAwareRepository';
import { userTenants, UserTenant, NewUserTenant, users, tenants, roles } from '@/db/schema';

export interface UserTenantWithDetails extends UserTenant {
  user?: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  };
  tenant?: {
    id: string;
    name: string;
    organizationName: string | null;
  };
  role?: {
    id: string;
    name: string;
    description: string | null;
  };
}

export class UserTenantRepository extends TenantAwareRepository<typeof userTenants, UserTenant, NewUserTenant> {
  constructor() {
    super(userTenants);
  }

  /**
   * Find user-tenant relationships by user ID for tenant
   */
  async findByUserIdForTenant(userId: string, tenantId: string): Promise<UserTenant | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.tenantId, tenantId)))
      .limit(1);
    return results[0];
  }

  /**
   * Find all tenants for a user
   */
  async findTenantsByUserId(userId: string): Promise<UserTenantWithDetails[]> {
    return await this.db
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
        }
      })
      .from(this.table)
      .innerJoin(users, eq(this.table.userId, users.id))
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id))
      .innerJoin(roles, eq(this.table.roleId, roles.id))
      .where(eq(this.table.userId, userId));
  }

  /**
   * Find all users for a tenant with details
   */
  async findUsersWithDetailsForTenant(tenantId: string): Promise<UserTenantWithDetails[]> {
    return await this.db
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
        }
      })
      .from(this.table)
      .innerJoin(users, eq(this.table.userId, users.id))
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id))
      .innerJoin(roles, eq(this.table.roleId, roles.id))
      .where(eq(this.table.tenantId, tenantId));
  }

  /**
   * Update user status for tenant
   */
  async updateStatusForTenant(userId: string, tenantId: string, status: 'pending' | 'active'): Promise<UserTenant | undefined> {
    return await this.updateByIdForTenant(userId, tenantId, { status });
  }

  /**
   * Mark user as accepted (completed setup)
   */
  async markAsAcceptedForTenant(userId: string, tenantId: string): Promise<UserTenant | undefined> {
    return await this.updateByIdForTenant(userId, tenantId, {
      status: 'active',
      acceptedAt: new Date(),
    });
  }

  /**
   * Update user role for tenant
   */
  async updateRoleForTenant(userId: string, tenantId: string, roleId: string): Promise<UserTenant | undefined> {
    return await this.updateByIdForTenant(userId, tenantId, { roleId });
  }

  /**
   * Set super user status for tenant
   */
  async setSuperUserForTenant(userId: string, tenantId: string, isSuperUser: boolean): Promise<UserTenant | undefined> {
    return await this.updateByIdForTenant(userId, tenantId, { isSuperUser });
  }

  /**
   * Find pending invitations for tenant
   */
  async findPendingInvitationsForTenant(tenantId: string): Promise<UserTenantWithDetails[]> {
    return await this.db
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
        }
      })
      .from(this.table)
      .innerJoin(users, eq(this.table.userId, users.id))
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id))
      .innerJoin(roles, eq(this.table.roleId, roles.id))
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.status, 'pending')));
  }

  /**
   * Find pending invitations for user
   */
  async findPendingInvitationsForUser(userId: string): Promise<UserTenantWithDetails[]> {
    return await this.db
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
        }
      })
      .from(this.table)
      .innerJoin(users, eq(this.table.userId, users.id))
      .innerJoin(tenants, eq(this.table.tenantId, tenants.id))
      .innerJoin(roles, eq(this.table.roleId, roles.id))
      .where(and(eq(this.table.userId, userId), eq(this.table.status, 'pending')));
  }

  /**
   * Check if user has access to tenant
   */
  async hasAccessToTenant(userId: string, tenantId: string): Promise<boolean> {
    const result = await this.findByUserIdForTenant(userId, tenantId);
    return !!result && result.status === 'active';
  }

  /**
   * Check if user is super user for tenant
   */
  async isSuperUserForTenant(userId: string, tenantId: string): Promise<boolean> {
    const result = await this.findByUserIdForTenant(userId, tenantId);
    return !!result && result.isSuperUser && result.status === 'active';
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(userId: string, tenantId: string): Promise<UserTenant | undefined> {
    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.tenantId, tenantId)))
      .returning();
    return result;
  }

  /**
   * Create user-tenant relationship with invitation
   */
  async createInvitationForTenant(
    tenantId: string,
    data: Omit<NewUserTenant, 'tenantId'> & { invitedAt?: Date }
  ): Promise<UserTenant> {
    const invitationData = {
      ...data,
      status: 'pending' as const,
      invitedAt: data.invitedAt || new Date(),
    };

    return await this.createForTenant(tenantId, invitationData);
  }
}