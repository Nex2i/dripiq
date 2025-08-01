import { eq, and } from 'drizzle-orm';
import { TenantAwareRepository } from '../base/TenantAwareRepository';
import { products, Product, NewProduct } from '@/db/schema';

export class ProductRepository extends TenantAwareRepository<typeof products, Product, NewProduct> {
  constructor() {
    super(products);
  }

  /**
   * Find default product for tenant
   */
  async findDefaultForTenant(tenantId: string): Promise<Product | undefined> {
    const results = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.isDefault, true)))
      .limit(1);
    return results[0];
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
    data: Omit<NewProduct, 'tenantId'>,
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
    data: {
      title?: string;
      description?: string;
      salesVoice?: string;
      siteUrl?: string;
    }
  ): Promise<Product | undefined> {
    return await this.updateByIdForTenant(id, tenantId, data);
  }

  /**
   * Find products with site URL for tenant
   */
  async findWithSiteUrlForTenant(tenantId: string): Promise<Product[]> {
    return await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.tenantId, tenantId), eq(this.table.siteUrl, null)));
  }

  /**
   * Check if product title exists for tenant
   */
  async titleExistsForTenant(title: string, tenantId: string, excludeId?: string): Promise<boolean> {
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