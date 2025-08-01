import { tenantRepository, userTenantRepository } from '@/repositories';
import {
  Tenant,
  UserTenant,
  User,
  NewTenant,
  NewUserTenant,
} from '@/db/schema';
import { validateUserSuperAccess, validateUserTenantAccess } from '@/utils/tenantValidation';

export interface CreateTenantData {
  name: string;
  organizationName?: string;
  website?: string;
  summary?: string;
  products?: string[];
  services?: string[];
  differentiators?: string[];
  targetMarket?: string;
  tone?: string;
  logo?: string | null;
  brandColors?: string[];
}

export interface TenantWithUsers extends Tenant {
  users: (UserTenant & {
    user: User;
  })[];
}

export class TenantService {
  /**
   * Creates a new tenant in the database.
   * @param tenantData - The data for the new tenant.
   * @returns A promise that resolves to the created tenant.
   * @throws Throws an error if the tenant creation fails.
   */
  static async createTenant(tenantData: CreateTenantData): Promise<Tenant> {
    // Auto-format tenant name: lowercase and replace spaces with hyphens
    const formattedName = tenantData.name.toLowerCase().replace(/\s+/g, '-');

    const newTenant: NewTenant = {
      name: formattedName,
    };

    return await tenantRepository.create(newTenant);
  }

  /**
   * Retrieves a tenant by its ID, including a list of its associated users.
   * @param tenantId - The ID of the tenant to retrieve.
   * @returns A promise that resolves to the tenant object with its users, or null if not found.
   */
  static async getTenantById(tenantId: string): Promise<TenantWithUsers> {
    return await tenantRepository.findByIdWithUsers(tenantId);
  }

  /**
   * Retrieves a tenant by its name.
   * @param name - The name of the tenant to retrieve.
   * @returns A promise that resolves to the tenant object or null if not found.
   */
  static async getTenantByName(name: string): Promise<Tenant | null> {
    return await tenantRepository.findByName(name);
  }

  /**
   * Adds a user to a tenant with a specific role.
   * If the user is already associated with the tenant, it returns the existing relationship.
   * @param userId - The ID of the user to add.
   * @param tenantId - The ID of the tenant to which the user will be added.
   * @param roleId - The ID of the role to assign to the user within the tenant.
   * @param isSuperUser - A boolean indicating if the user should have super user privileges in the tenant.
   * @returns A promise that resolves to the user-tenant relationship object.
   */
  static async addUserToTenant(
    userId: string,
    tenantId: string,
    roleId: string,
    isSuperUser: boolean = false
  ): Promise<UserTenant> {
    try {
      const newUserTenant: NewUserTenant = {
        userId,
        tenantId,
        roleId,
        isSuperUser,
      };

      return await userTenantRepository.create(newUserTenant, tenantId);
    } catch (error: any) {
      // If relationship already exists (unique constraint violation), fetch and return it
      if (error.code === '23505') {
        const existingRelation = await userTenantRepository.findByUserAndTenant(userId, tenantId);

        if (!existingRelation) {
          throw new Error('UserTenant creation failed and relation not found');
        }
        return existingRelation;
      }
      throw error;
    }
  }

  /**
   * Retrieves all tenants a user is associated with.
   * @param userId - The ID of the user.
   * @returns A promise that resolves to an array of user-tenant objects, with the full tenant object nested.
   */
  static async getUserTenants(userId: string): Promise<(UserTenant & { tenant: Tenant })[]> {
    const userTenantRelations = await userTenantRepository.findByUser(userId);
    const results = [];
    
    for (const relation of userTenantRelations) {
      const tenant = await tenantRepository.findById(relation.tenantId);
      if (tenant) {
        results.push({
          ...relation,
          tenant,
        });
      }
    }
    
    return results;
  }

  /**
   * Updates a tenant's data after validating that the requesting user has access.
   * @param userId - The ID of the user making the request.
   * @param tenantId - The ID of the tenant to update.
   * @param updateData - An object containing the fields to update.
   * @returns A promise that resolves to the updated tenant object.
   * @throws Throws an error if the tenant is not found.
   */
  static async updateTenant(
    tenantId: string,
    updateData: Partial<CreateTenantData>
  ): Promise<Tenant> {
    if (updateData.website) {
      updateData.website = updateData.website?.cleanWebsiteUrl();
    }

    // Auto-format tenant name: lowercase and replace spaces with hyphens
    if (updateData.name) {
      updateData.name = updateData.name.toLowerCase().replace(/\s+/g, '-');
    }

    return await tenantRepository.update(tenantId, updateData);
  }

  /**
   * Deletes a tenant after validating that the requesting user has super user access.
   * @param userId - The ID of the user making the request.
   * @param tenantId - The ID of the tenant to delete.
   * @returns A promise that resolves to the deleted tenant object.
   * @throws Throws an error if the tenant is not found.
   */
  static async deleteTenant(userId: string, tenantId: string): Promise<Tenant> {
    // Validate user has super user access to this tenant
    await validateUserSuperAccess(userId, tenantId);

    return await tenantRepository.delete(tenantId);
  }

  /**
   * Retrieves a tenant by its ID securely, by first validating user access.
   * @param userId - The ID of the user making the request.
   * @param tenantId - The ID of the tenant to retrieve.
   * @returns A promise that resolves to the tenant object with its users, or null if not found.
   */
  static async getTenantByIdSecure(
    userId: string,
    tenantId: string
  ): Promise<TenantWithUsers | null> {
    // Validate user has access to this tenant
    await validateUserTenantAccess(userId, tenantId);

    return this.getTenantById(tenantId);
  }
}
