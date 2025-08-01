import { eq, and } from 'drizzle-orm';
import { leadProducts, leads, products, LeadProduct, NewLeadProduct, Lead, Product } from '@/db/schema';
import { BaseRepository, IRepository } from './base.repository';

export interface LeadProductWithDetails extends LeadProduct {
  lead: Lead;
  product: Product;
}

export class LeadProductRepository extends BaseRepository implements IRepository<LeadProduct, NewLeadProduct> {
  /**
   * Find lead-product relationship by ID
   */
  async findById(id: string, tenantId: string, userId?: string): Promise<LeadProduct | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead-product relationship belongs to the tenant
      const result = await this.db
        .select({ leadProduct: leadProducts })
        .from(leadProducts)
        .innerJoin(leads, eq(leadProducts.leadId, leads.id))
        .innerJoin(products, eq(leadProducts.productId, products.id))
        .where(and(
          eq(leadProducts.id, id),
          eq(leads.tenantId, tenantId),
          eq(products.tenantId, tenantId)
        ))
        .limit(1);

      return result[0]?.leadProduct || null;
    } catch (error) {
      this.handleError(error, 'findById');
    }
  }

  /**
   * Create a new lead-product relationship
   */
  async create(data: NewLeadProduct, tenantId: string, userId?: string): Promise<LeadProduct> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify both lead and product belong to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, data.leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      const productExists = await this.db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, data.productId), eq(products.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      if (productExists.length === 0) {
        throw new Error('Product not found or access denied');
      }

      const [leadProduct] = await this.db.insert(leadProducts).values(data).returning();
      if (!leadProduct) {
        throw new Error('Failed to create lead-product relationship');
      }
      return leadProduct;
    } catch (error) {
      this.handleError(error, 'create');
    }
  }

  /**
   * Update lead-product relationship
   */
  async update(id: string, updateData: Partial<NewLeadProduct>, tenantId: string, userId?: string): Promise<LeadProduct> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the relationship exists and belongs to the tenant
      const existing = await this.findById(id, tenantId, userId);
      if (!existing) {
        throw new Error('Lead-product relationship not found or access denied');
      }

      const [leadProduct] = await this.db
        .update(leadProducts)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(leadProducts.id, id))
        .returning();

      if (!leadProduct) {
        throw new Error('Failed to update lead-product relationship');
      }
      return leadProduct;
    } catch (error) {
      this.handleError(error, 'update');
    }
  }

  /**
   * Delete lead-product relationship
   */
  async delete(id: string, tenantId: string, userId?: string): Promise<LeadProduct> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the relationship exists and belongs to the tenant
      const existing = await this.findById(id, tenantId, userId);
      if (!existing) {
        throw new Error('Lead-product relationship not found or access denied');
      }

      const [leadProduct] = await this.db
        .delete(leadProducts)
        .where(eq(leadProducts.id, id))
        .returning();

      if (!leadProduct) {
        throw new Error('Failed to delete lead-product relationship');
      }
      return leadProduct;
    } catch (error) {
      this.handleError(error, 'delete');
    }
  }

  /**
   * Find lead-product relationship by lead and product IDs
   */
  async findByLeadAndProduct(leadId: string, productId: string, tenantId: string, userId?: string): Promise<LeadProduct | null> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify both lead and product belong to the tenant
      const result = await this.db
        .select({ leadProduct: leadProducts })
        .from(leadProducts)
        .innerJoin(leads, eq(leadProducts.leadId, leads.id))
        .innerJoin(products, eq(leadProducts.productId, products.id))
        .where(and(
          eq(leadProducts.leadId, leadId),
          eq(leadProducts.productId, productId),
          eq(leads.tenantId, tenantId),
          eq(products.tenantId, tenantId)
        ))
        .limit(1);

      return result[0]?.leadProduct || null;
    } catch (error) {
      this.handleError(error, 'findByLeadAndProduct');
    }
  }

  /**
   * Find all products for a lead
   */
  async findProductsByLead(leadId: string, tenantId: string, userId?: string): Promise<Product[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead belongs to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      const result = await this.db
        .select({ product: products })
        .from(leadProducts)
        .innerJoin(products, eq(leadProducts.productId, products.id))
        .where(and(
          eq(leadProducts.leadId, leadId),
          eq(products.tenantId, tenantId)
        ))
        .orderBy(leadProducts.attachedAt);

      return result.map(row => row.product);
    } catch (error) {
      this.handleError(error, 'findProductsByLead');
    }
  }

  /**
   * Find all leads for a product
   */
  async findLeadsByProduct(productId: string, tenantId: string, userId?: string): Promise<Lead[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the product belongs to the tenant
      const productExists = await this.db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .limit(1);

      if (productExists.length === 0) {
        throw new Error('Product not found or access denied');
      }

      const result = await this.db
        .select({ lead: leads })
        .from(leadProducts)
        .innerJoin(leads, eq(leadProducts.leadId, leads.id))
        .where(and(
          eq(leadProducts.productId, productId),
          eq(leads.tenantId, tenantId)
        ))
        .orderBy(leadProducts.attachedAt);

      return result.map(row => row.lead);
    } catch (error) {
      this.handleError(error, 'findLeadsByProduct');
    }
  }

  /**
   * Find lead-product relationships by lead ID
   */
  async findByLead(leadId: string, tenantId: string, userId?: string): Promise<LeadProduct[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the lead belongs to the tenant
      const leadExists = await this.db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
        .limit(1);

      if (leadExists.length === 0) {
        throw new Error('Lead not found or access denied');
      }

      return await this.db
        .select()
        .from(leadProducts)
        .where(eq(leadProducts.leadId, leadId))
        .orderBy(leadProducts.attachedAt);
    } catch (error) {
      this.handleError(error, 'findByLead');
    }
  }

  /**
   * Find lead-product relationships by product ID
   */
  async findByProduct(productId: string, tenantId: string, userId?: string): Promise<LeadProduct[]> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      // Verify the product belongs to the tenant
      const productExists = await this.db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)))
        .limit(1);

      if (productExists.length === 0) {
        throw new Error('Product not found or access denied');
      }

      return await this.db
        .select()
        .from(leadProducts)
        .where(eq(leadProducts.productId, productId))
        .orderBy(leadProducts.attachedAt);
    } catch (error) {
      this.handleError(error, 'findByProduct');
    }
  }

  /**
   * Attach product to lead
   */
  async attachProductToLead(leadId: string, productId: string, tenantId: string, userId?: string): Promise<LeadProduct> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      return await this.create({ leadId, productId }, tenantId, userId);
    } catch (error) {
      this.handleError(error, 'attachProductToLead');
    }
  }

  /**
   * Detach product from lead
   */
  async detachProductFromLead(leadId: string, productId: string, tenantId: string, userId?: string): Promise<void> {
    try {
      if (userId) {
        await this.validateUserTenantAccess(userId, tenantId);
      }

      const relationship = await this.findByLeadAndProduct(leadId, productId, tenantId, userId);
      if (relationship) {
        await this.delete(relationship.id, tenantId, userId);
      }
    } catch (error) {
      this.handleError(error, 'detachProductFromLead');
    }
  }
}