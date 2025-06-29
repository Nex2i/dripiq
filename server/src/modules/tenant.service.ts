import { Tenant, UserTenant, User } from '@prisma/client';
import prisma from '@/libs/prismaClient';

export interface CreateTenantData {
  name: string;
}

export interface TenantWithUsers extends Tenant {
  users: (UserTenant & {
    user: User;
  })[];
}

export class TenantService {
  /**
   * Create a new tenant in the database
   */
  static async createTenant(tenantData: CreateTenantData): Promise<Tenant> {
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantData.name,
      },
    });
    return tenant;
  }

  /**
   * Get tenant by ID with users
   */
  static async getTenantById(tenantId: string): Promise<TenantWithUsers | null> {
    return await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * Get tenant by name
   */
  static async getTenantByName(name: string): Promise<Tenant | null> {
    return await prisma.tenant.findFirst({
      where: { name },
    });
  }

  /**
   * Add user to tenant as super user
   */
  static async addUserToTenant(
    userId: string,
    tenantId: string,
    isSuperUser: boolean = false
  ): Promise<UserTenant> {
    try {
      const userTenant = await prisma.userTenant.create({
        data: {
          userId,
          tenantId,
          isSuperUser,
        },
      });
      return userTenant;
    } catch (error: any) {
      // If relationship already exists, fetch and return it
      if (error.code === 'P2002') {
        const existingRelation = await prisma.userTenant.findUniqueOrThrow({
          where: {
            userId_tenantId: {
              userId,
              tenantId,
            },
          },
        });
        return existingRelation;
      }
      throw error;
    }
  }

  /**
   * Get user's tenants
   */
  static async getUserTenants(userId: string): Promise<(UserTenant & { tenant: Tenant })[]> {
    return await prisma.userTenant.findMany({
      where: { userId },
      include: {
        tenant: true,
      },
    });
  }

  /**
   * Update tenant data
   */
  static async updateTenant(
    tenantId: string,
    updateData: Partial<CreateTenantData>
  ): Promise<Tenant> {
    return await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });
  }

  /**
   * Delete tenant
   */
  static async deleteTenant(tenantId: string): Promise<Tenant> {
    return await prisma.tenant.delete({
      where: { id: tenantId },
    });
  }
}
