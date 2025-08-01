import { eq, and, inArray } from 'drizzle-orm';
import { BaseRepository } from '../base/BaseRepository';
import { leadProducts, LeadProduct, NewLeadProduct, leads, products } from '@/db/schema';

export interface LeadProductWithDetails extends LeadProduct {
  lead?: {
    id: string;
    name: string;
    url: string;
    tenantId: string;
  };
  product?: {
    id: string;
    title: string;
    description: string | null;
    tenantId: string;
  };
}

export class LeadProductRepository extends BaseRepository<typeof leadProducts, LeadProduct, NewLeadProduct> {
  constructor() {
    super(leadProducts);
  }

  /**
   * Find lead-product associations by lead ID with tenant validation
   */
  async findByLeadIdForTenant(leadId: string, tenantId: string): Promise<LeadProduct[]> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .where(and(eq(this.table.leadId, leadId), eq(leads.tenantId, tenantId)));
    return results.map(result => result.lead_products);
  }

  /**
   * Find lead-product associations by product ID with tenant validation
   */
  async findByProductIdForTenant(productId: string, tenantId: string): Promise<LeadProduct[]> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(products, eq(this.table.productId, products.id))
      .where(and(eq(this.table.productId, productId), eq(products.tenantId, tenantId)));
    return results.map(result => result.lead_products);
  }

  /**
   * Check if lead-product association exists with tenant validation
   */
  async existsForTenant(leadId: string, productId: string, tenantId: string): Promise<boolean> {
    const results = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .innerJoin(products, eq(this.table.productId, products.id))
      .where(and(
        eq(this.table.leadId, leadId),
        eq(this.table.productId, productId),
        eq(leads.tenantId, tenantId),
        eq(products.tenantId, tenantId)
      ))
      .limit(1);
    return results.length > 0;
  }

  /**
   * Attach products to lead with tenant validation
   */
  async attachProductsToLeadForTenant(
    leadId: string,
    productIds: string[],
    tenantId: string
  ): Promise<LeadProduct[]> {
    if (productIds.length === 0) return [];

    // Verify lead belongs to tenant
    const lead = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead[0]) {
      throw new Error('Lead not found or does not belong to tenant');
    }

    // Verify products belong to tenant
    const productsInTenant = await this.db
      .select()
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.tenantId, tenantId)));

    if (productsInTenant.length !== productIds.length) {
      throw new Error('One or more products do not belong to tenant');
    }

    // Get existing associations to avoid duplicates
    const existingAssociations = await this.findByLeadIdForTenant(leadId, tenantId);
    const existingProductIds = existingAssociations.map(assoc => assoc.productId);

    // Filter out already attached products
    const newProductIds = productIds.filter(id => !existingProductIds.includes(id));
    
    if (newProductIds.length === 0) return [];

    const newAttachments = newProductIds.map(productId => ({
      leadId,
      productId,
    }));

    return await this.createMany(newAttachments);
  }

  /**
   * Detach product from lead with tenant validation
   */
  async detachProductFromLeadForTenant(
    leadId: string,
    productId: string,
    tenantId: string
  ): Promise<LeadProduct | undefined> {
    // Verify both lead and product belong to tenant
    const verification = await this.db
      .select()
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .innerJoin(products, eq(this.table.productId, products.id))
      .where(and(
        eq(this.table.leadId, leadId),
        eq(this.table.productId, productId),
        eq(leads.tenantId, tenantId),
        eq(products.tenantId, tenantId)
      ))
      .limit(1);

    if (verification.length === 0) {
      return undefined;
    }

    const [result] = await this.db
      .delete(this.table)
      .where(and(eq(this.table.leadId, leadId), eq(this.table.productId, productId)))
      .returning();

    return result;
  }

  /**
   * Detach all products from lead with tenant validation
   */
  async detachAllProductsFromLeadForTenant(leadId: string, tenantId: string): Promise<LeadProduct[]> {
    // Verify lead belongs to tenant
    const lead = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead[0]) {
      return [];
    }

    return await this.db
      .delete(this.table)
      .where(eq(this.table.leadId, leadId))
      .returning();
  }

  /**
   * Get leads with attached products for tenant
   */
  async findLeadsWithProductsForTenant(tenantId: string): Promise<LeadProductWithDetails[]> {
    return await this.db
      .select({
        id: this.table.id,
        leadId: this.table.leadId,
        productId: this.table.productId,
        attachedAt: this.table.attachedAt,
        createdAt: this.table.createdAt,
        updatedAt: this.table.updatedAt,
        lead: {
          id: leads.id,
          name: leads.name,
          url: leads.url,
          tenantId: leads.tenantId,
        },
        product: {
          id: products.id,
          title: products.title,
          description: products.description,
          tenantId: products.tenantId,
        }
      })
      .from(this.table)
      .innerJoin(leads, eq(this.table.leadId, leads.id))
      .innerJoin(products, eq(this.table.productId, products.id))
      .where(and(eq(leads.tenantId, tenantId), eq(products.tenantId, tenantId)));
  }

  /**
   * Count products attached to lead
   */
  async countProductsForLeadAndTenant(leadId: string, tenantId: string): Promise<number> {
    const results = await this.findByLeadIdForTenant(leadId, tenantId);
    return results.length;
  }

  /**
   * Count leads attached to product
   */
  async countLeadsForProductAndTenant(productId: string, tenantId: string): Promise<number> {
    const results = await this.findByProductIdForTenant(productId, tenantId);
    return results.length;
  }
}