import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../db';
import { leadProducts, leads, products } from '../db/schema';
import type { NewLeadProduct, LeadProduct } from '../db/schema';

/**
 * Get all products attached to a specific lead
 */
export async function getLeadProducts(leadId: string, tenantId: string) {
  try {
    const result = await db
      .select({
        id: leadProducts.id,
        leadId: leadProducts.leadId,
        productId: leadProducts.productId,
        attachedAt: leadProducts.attachedAt,
        createdAt: leadProducts.createdAt,
        updatedAt: leadProducts.updatedAt,
        product: {
          id: products.id,
          title: products.title,
          description: products.description,
          salesVoice: products.salesVoice,
          tenantId: products.tenantId,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        },
      })
      .from(leadProducts)
      .innerJoin(products, eq(leadProducts.productId, products.id))
      .innerJoin(leads, eq(leadProducts.leadId, leads.id))
      .where(
        and(
          eq(leadProducts.leadId, leadId),
          eq(leads.tenantId, tenantId) // Ensure tenant isolation
        )
      )
      .orderBy(leadProducts.attachedAt);

    return result;
  } catch (error) {
    console.error('Error getting lead products:', error);
    throw new Error('Failed to get lead products');
  }
}

/**
 * Attach products to a lead
 */
export async function attachProductsToLead(
  leadId: string,
  productIds: string[],
  tenantId: string
): Promise<LeadProduct[]> {
  try {
    // First verify that the lead belongs to the tenant
    const leadExists = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (leadExists.length === 0) {
      throw new Error('Lead not found or access denied');
    }

    // Verify that all products belong to the tenant
    const validProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId)
          // Check if productIds are in the valid products list
        )
      );

    const validProductIds = validProducts.map((p) => p.id);
    const invalidProductIds = productIds.filter((id) => !validProductIds.includes(id));

    if (invalidProductIds.length > 0) {
      throw new Error(`Invalid product IDs: ${invalidProductIds.join(', ')}`);
    }

    // Check for existing attachments to avoid duplicates
    const existingAttachments = await db
      .select({ productId: leadProducts.productId })
      .from(leadProducts)
      .where(eq(leadProducts.leadId, leadId));

    const existingProductIds = existingAttachments.map((a) => a.productId);
    const newProductIds = productIds.filter((id) => !existingProductIds.includes(id));

    if (newProductIds.length === 0) {
      throw new Error('All products are already attached to this lead');
    }

    // Create the new attachments
    const newAttachments: NewLeadProduct[] = newProductIds.map((productId) => ({
      id: createId(),
      leadId,
      productId,
      attachedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await db.insert(leadProducts).values(newAttachments).returning();
    return result;
  } catch (error) {
    console.error('Error attaching products to lead:', error);
    throw error;
  }
}

/**
 * Detach a product from a lead
 */
export async function detachProductFromLead(
  leadId: string,
  productId: string,
  tenantId: string
): Promise<boolean> {
  try {
    // Verify that the lead belongs to the tenant
    const leadExists = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (leadExists.length === 0) {
      throw new Error('Lead not found or access denied');
    }

    // Delete the attachment
    const result = await db
      .delete(leadProducts)
      .where(and(eq(leadProducts.leadId, leadId), eq(leadProducts.productId, productId)))
      .returning();

    return result.length > 0;
  } catch (error) {
    console.error('Error detaching product from lead:', error);
    throw error;
  }
}

/**
 * Get the count of products attached to a lead
 */
export async function getLeadProductCount(leadId: string, tenantId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: leadProducts.id })
      .from(leadProducts)
      .innerJoin(leads, eq(leadProducts.leadId, leads.id))
      .where(and(eq(leadProducts.leadId, leadId), eq(leads.tenantId, tenantId)));

    return result.length;
  } catch (error) {
    console.error('Error getting lead product count:', error);
    throw new Error('Failed to get lead product count');
  }
}
