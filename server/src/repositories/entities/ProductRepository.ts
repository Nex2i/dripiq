import { eq, and } from 'drizzle-orm';
import { products, Product, NewProduct } from '@/db/schema';
import { TenantAwareRepository } from '../base/TenantAwareRepository';

export class ProductRepository extends TenantAwareRepository<typeof products, Product, NewProduct> {
  constructor() {
    super(products);
  }

  /**
   * Get all products for a tenant
   */
  async findByTenantId(tenantId: string): Promise<Product[]> {
    return await this.db.select().from(this.table).where(eq(this.table.tenantId, tenantId));
  }

  /**
   * Get default products for a tenant
   */
  async findDefaultForTenant(tenantId: string): Promise<Product[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.isDefault, true)));
  }

  /**
   * Unset product as default
   */
  async unsetAsDefaultForTenant(id: string, tenantId: string): Promise<Product | undefined> {
    return await this.updateByIdForTenant(id, tenantId, { isDefault: false });
  }

  /**
   * Create product and optionally set as default
   */
  async createForTenantWithDefault(
    tenantId: string,
    data: Omit<NewProduct, 'id'>,
    setAsDefault = false
  ): Promise<Product> {
    let productData = { ...data };

    if (setAsDefault) {
      // Unset all other defaults first
      await this.db
        .update(this.table)
        .set({ isDefault: false })
        .where(and(eq(this.table.tenantId, tenantId), eq(this.table.isDefault, true)));

      productData.isDefault = true;
    }

    return await this.createForTenant(tenantId, productData);
  }
}
