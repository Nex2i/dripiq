import { db } from '@/db';
import { 
  tenants, 
  users,
  userTenants,
  roles,
  products,
  NewTenant, 
  NewUser,
  NewUserTenant,
  NewProduct,
  Tenant,
  User,
  UserTenant,
  Role,
  Product
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface CreateTenantWithOwnerData {
  tenant: NewTenant;
  owner: NewUser;
  ownerRoleId: string;
  defaultProducts?: Omit<NewProduct, 'tenantId'>[];
}

export interface TenantSetupResult {
  tenant: Tenant;
  owner: User;
  userTenant: UserTenant;
  role: Role;
  products: Product[];
  wasOwnerCreated: boolean;
}

export interface TenantWithInitialSetupData extends CreateTenantWithOwnerData {
  additionalUsers?: {
    user: NewUser;
    roleId: string;
    isSuperUser?: boolean;
  }[];
}

export interface CompleteSetupResult extends TenantSetupResult {
  additionalUsers: {
    user: User;
    userTenant: UserTenant;
    role: Role;
    wasUserCreated: boolean;
  }[];
}

export class TenantSetupTransactionRepository {
  /**
   * Create a tenant with an owner user in a single transaction
   */
  async createTenantWithOwner(
    data: CreateTenantWithOwnerData
  ): Promise<TenantSetupResult> {
    return await db.transaction(async (tx) => {
      // Create tenant
      const [tenant] = await tx.insert(tenants).values(data.tenant).returning();
      if (!tenant) {
        throw new Error('Failed to create tenant');
      }

      // Check if owner user already exists
      const existingUsers = await tx
        .select()
        .from(users)
        .where(eq(users.email, data.owner.email))
        .limit(1);

      let owner: User;
      let wasOwnerCreated = false;

      if (existingUsers.length > 0) {
        owner = existingUsers[0]!;
      } else {
        const [createdOwner] = await tx.insert(users).values(data.owner).returning();
        if (!createdOwner) {
          throw new Error('Failed to create owner user');
        }
        owner = createdOwner;
        wasOwnerCreated = true;
      }

      // Verify role exists
      const roleResults = await tx
        .select()
        .from(roles)
        .where(eq(roles.id, data.ownerRoleId))
        .limit(1);

      if (roleResults.length === 0) {
        throw new Error('Owner role not found');
      }

      const role = roleResults[0]!;

      // Create user-tenant relationship (owner with super user privileges)
      const userTenantData: NewUserTenant = {
        userId: owner.id,
        tenantId: tenant.id,
        roleId: data.ownerRoleId,
        isSuperUser: true,
        status: 'active',
        invitedAt: new Date(),
        acceptedAt: new Date(),
      };

      const [userTenant] = await tx.insert(userTenants).values(userTenantData).returning();
      if (!userTenant) {
        throw new Error('Failed to create user-tenant relationship');
      }

      // Create default products if provided
      let createdProducts: Product[] = [];
      if (data.defaultProducts && data.defaultProducts.length > 0) {
        const productsWithTenant = data.defaultProducts.map(product => ({
          ...product,
          tenantId: tenant.id,
        }));
        createdProducts = await tx.insert(products).values(productsWithTenant as any).returning() as Product[];
      }

      return {
        tenant,
        owner,
        userTenant,
        role,
        products: createdProducts,
        wasOwnerCreated,
      };
    });
  }

  /**
   * Create a tenant with owner and additional users
   */
  async createTenantWithCompleteSetup(
    data: TenantWithInitialSetupData
  ): Promise<CompleteSetupResult> {
    return await db.transaction(async (tx) => {
      // Create tenant with owner
      const setupResult = await this.createTenantWithOwner({
        tenant: data.tenant,
        owner: data.owner,
        ownerRoleId: data.ownerRoleId,
        defaultProducts: data.defaultProducts,
      });

      const additionalUsers: CompleteSetupResult['additionalUsers'] = [];

      // Add additional users if provided
      if (data.additionalUsers && data.additionalUsers.length > 0) {
        for (const userData of data.additionalUsers) {
          // Check if user already exists
          const existingUsers = await tx
            .select()
            .from(users)
            .where(eq(users.email, userData.user.email))
            .limit(1);

          let user: User;
          let wasUserCreated = false;

          if (existingUsers.length > 0) {
            const existingUser = existingUsers[0];
            if (!existingUser) {
              throw new Error('Existing user is undefined');
            }
            user = existingUser;
          } else {
            const [createdUser] = await tx.insert(users).values(userData.user).returning();
            if (!createdUser) {
              throw new Error('Failed to create user');
            }
            user = createdUser;
            wasUserCreated = true;
          }

          // Verify role exists
          const roleResults = await tx
            .select()
            .from(roles)
            .where(eq(roles.id, userData.roleId))
            .limit(1);

          if (roleResults.length === 0) {
            throw new Error(`Role not found for user ${userData.user.email}`);
          }

          const role = roleResults[0];

          // Create user-tenant relationship
          const userTenantData: NewUserTenant = {
            userId: user.id,
            tenantId: setupResult.tenant.id,
            roleId: userData.roleId,
            isSuperUser: userData.isSuperUser || false,
            status: 'pending',
            invitedAt: new Date(),
          };

          const [userTenant] = await tx.insert(userTenants).values(userTenantData).returning();
          
          if (!userTenant) {
            throw new Error('Failed to create user-tenant relationship');
          }
          
          if (!role) {
            throw new Error('Role is undefined');
          }

          additionalUsers.push({
            user,
            userTenant,
            role,
            wasUserCreated,
          });
        }
      }

      return {
        ...setupResult,
        additionalUsers,
      };
    });
  }

  /**
   * Delete tenant and all associated data
   */
  async deleteTenantWithAllData(tenantId: string): Promise<{
    tenant: Tenant | undefined;
    userTenantsDeleted: number;
    productsDeleted: number;
    // Note: Users are not deleted as they might belong to other tenants
  }> {
    return await db.transaction(async (tx) => {
      // Delete user-tenant relationships
      const deletedUserTenants = await tx
        .delete(userTenants)
        .where(eq(userTenants.tenantId, tenantId))
        .returning();

      // Delete products
      const deletedProducts = await tx
        .delete(products)
        .where(eq(products.tenantId, tenantId))
        .returning();

      // Delete tenant (this will cascade delete leads, lead statuses, etc.)
      const [deletedTenant] = await tx
        .delete(tenants)
        .where(eq(tenants.id, tenantId))
        .returning();

      return {
        tenant: deletedTenant,
        userTenantsDeleted: deletedUserTenants.length,
        productsDeleted: deletedProducts.length,
      };
    });
  }

  /**
   * Transfer tenant ownership to another user
   */
  async transferTenantOwnership(
    tenantId: string,
    newOwnerId: string,
    demoteCurrentOwner: boolean = true
  ): Promise<{
    newOwner: UserTenant;
    formerOwners: UserTenant[];
  }> {
    return await db.transaction(async (tx) => {
      let formerOwners: UserTenant[] = [];

      if (demoteCurrentOwner) {
        // Demote current super users
        formerOwners = await tx
          .update(userTenants)
          .set({ isSuperUser: false })
          .where(eq(userTenants.tenantId, tenantId))
          .returning();
      }

      // Promote new owner
      const [newOwner] = await tx
        .update(userTenants)
        .set({ 
          isSuperUser: true,
          status: 'active', // Ensure new owner is active
        })
        .where(eq(userTenants.userId, newOwnerId))
        .returning();

      if (!newOwner) {
        throw new Error('New owner user-tenant relationship not found');
      }

      return {
        newOwner,
        formerOwners,
      };
    });
  }

  /**
   * Setup initial products for a tenant
   */
  async setupInitialProducts(
    tenantId: string,
    productData: Omit<NewProduct, 'tenantId'>[],
    setFirstAsDefault: boolean = true
  ): Promise<Product[]> {
    return await db.transaction(async (tx) => {
      // Prepare products data
      const productsWithTenant = productData.map((product, index) => ({
        ...product,
        tenantId,
        isDefault: setFirstAsDefault && index === 0,
      }));

      // Create products
      const createdProducts = await tx.insert(products).values(productsWithTenant).returning();

      return createdProducts as Product[];
    });
  }

  /**
   * Clone tenant structure (without data) for creating similar tenants
   */
  async cloneTenantStructure(
    sourceTenantId: string,
    newTenantData: NewTenant,
    newOwnerData: NewUser,
    ownerRoleId: string
  ): Promise<TenantSetupResult> {
    return await db.transaction(async (tx) => {
      // Get source tenant products
      const sourceProducts = await tx
        .select()
        .from(products)
        .where(eq(products.tenantId, sourceTenantId));

      // Prepare default products from source (without tenant-specific data)
      const defaultProducts = sourceProducts.map(product => ({
        title: product.title,
        description: product.description,
        salesVoice: product.salesVoice,
        siteUrl: product.siteUrl,
        isDefault: product.isDefault,
      }));

      // Create new tenant with structure
      return await this.createTenantWithOwner({
        tenant: newTenantData,
        owner: newOwnerData,
        ownerRoleId,
        defaultProducts,
      });
    });
  }

  /**
   * Archive tenant (mark as inactive without deleting)
   */
  async archiveTenant(tenantId: string): Promise<{
    tenant: Tenant | undefined;
    archivedUserTenants: UserTenant[];
  }> {
    return await db.transaction(async (tx) => {
      // Mark all user-tenant relationships as inactive
      const archivedUserTenants = await tx
        .update(userTenants)
        .set({ status: 'pending' }) // Use pending as archived status
        .where(eq(userTenants.tenantId, tenantId))
        .returning();

      // Note: We don't have an 'archived' field in tenant schema
      // This could be added later or handled through a separate archival table
      const [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      return {
        tenant,
        archivedUserTenants,
      };
    });
  }
}