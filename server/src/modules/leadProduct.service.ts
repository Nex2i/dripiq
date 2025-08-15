import { logger } from '@/libs/logger';
import { leadProductRepository } from '../repositories';
import type { LeadProduct } from '../db/schema';

/**
 * Get all products attached to a specific lead
 */
export async function getLeadProducts(leadId: string, tenantId: string) {
  try {
    const result = await leadProductRepository.findLeadsWithProductsForTenant(tenantId);

    // Filter results for the specific lead
    const leadProducts = result.filter((item) => item.leadId === leadId);

    // Transform to match the expected format
    return leadProducts.map((item) => ({
      id: item.id,
      leadId: item.leadId,
      productId: item.productId,
      attachedAt: item.attachedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: item.product,
    }));
  } catch (error) {
    logger.error('Error getting lead products', error);
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
    const result = await leadProductRepository.attachProductsToLeadForTenant(
      leadId,
      productIds,
      tenantId
    );
    return result;
  } catch (error) {
    logger.error('Error attaching products to lead', error);
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
    const result = await leadProductRepository.detachProductFromLeadForTenant(
      leadId,
      productId,
      tenantId
    );
    return !!result;
  } catch (error) {
    logger.error('Error detaching product from lead', error);
    throw error;
  }
}
