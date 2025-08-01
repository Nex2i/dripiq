import { eq, and } from 'drizzle-orm';
import { products, Product, NewProduct } from '@/db/schema';
import { BaseRepository, ITenantScopedRepository } from './base.repository';

export class ProductRepository extends BaseRepository implements ITenantScopedRepository<Product, NewProduct> {
  /**
   * Find product by ID within tenant scope
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<Product | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const result = await this.db
        .select()
        .from(products)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new product within tenant scope
   */
  async create(productData: NewProduct, tenantId: string, userId?: string): Promise<Product> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Ensure tenantId matches the data
      const dataWithTenant = { ...productData, tenantId };

      const [product] = await this.db.insert(products).values(dataWithTenant).returning();
      if (!product) {
        throw new Error('Failed to create product');
      }
      return product;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update product within tenant scope
   */
  async update(id: string, updateData: Partial<NewProduct>, tenantId: string, userId?: string): Promise<Product> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [product] = await this.db
        .update(products)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .returning();

      if (!product) {
        throw new Error('Product not found or access denied');
      }
      return product;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete product within tenant scope
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<Product> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const [product] = await this.db
        .delete(products)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .returning();

      if (!product) {
        throw new Error('Product not found or access denied');
      }
      return product;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find all products for a tenant
   */
  async findByTenant(tenantId: string, userId?: string): Promise<Product[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(products)
        .where(eq(products.tenantId, tenantId))
        .orderBy(products.createdAt);
    } catch (error) {
      this.handleError(error, 'findByTenant');
    }
  }

  /**
   * Find default products for a tenant
   */
  async findDefaultByTenant(tenantId: string, userId?: string): Promise<Product[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.db
        .select()
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.isDefault, true)))
        .orderBy(products.createdAt);
    } catch (error) {
      this.handleError(error, 'findDefaultByTenant');
    }
  }

  /**
   * Check if product exists within tenant scope
   */
  async exists(id: string, tenantId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.handleError(error, 'exists');
    }
  }
}