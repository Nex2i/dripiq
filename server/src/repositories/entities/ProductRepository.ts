import { eq, and, isNull } from 'drizzle-orm';
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
   * Find products by title for tenant
   */
  async findByTitleForTenant(title: string, tenantId: string): Promise<Product[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.title, title), eq(this.table.tenantId, tenantId)));
  }

  /**
   * Set product as default (unsets other defaults)
   */
  async setAsDefaultForTenant(id: string, tenantId: string): Promise<Product | undefined> {
    // First, unset all other defaults for this tenant
    await this.db
      .update(this.table)
      .set({ isDefault: false })
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.isDefault, true)));

    // Then set this product as default
    return await this.updateByIdForTenant(id, tenantId, { isDefault: true });
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

  /**
   * Update product details
   */
  async updateDetailsForTenant(
    id: string,
    tenantId: string,
    data: Partial<Product>
  ): Promise<Product | undefined> {
    return await this.updateByIdForTenant(id, tenantId, data);
  }

  /**
   * Find products with site URL for tenant
   */
  async findWithSiteUrlForTenant(tenantId: string): Promise<Product[]> {
    return (await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), isNull(this.table.siteUrl)))) as Product[];
  }

  /**
   * Check if product title exists for tenant
   */
  async titleExistsForTenant(
    title: string,
    tenantId: string,
    excludeId?: string
  ): Promise<boolean> {
    let conditions = [eq(this.table.title, title), eq(this.table.tenantId, tenantId)];

    if (excludeId) {
      conditions.push(eq(this.table.id, excludeId));
    }

    const results = await this.db
      .select()
      .from(this.table)
      .where(and(...conditions))
      .limit(1);

    return results.length > 0;
  }
}
