import { leadProductRepository, productRepository } from '@/repositories';
import type { NewLeadProduct, LeadProduct } from '../db/schema';

/**
 * Get all products attached to a specific lead
 */
export async function getLeadProducts(leadId: string, tenantId: string, userId?: string) {
  try {
    const products = await leadProductRepository.findProductsByLead(leadId, tenantId, userId);
    const leadProductRelations = await leadProductRepository.findByLead(leadId, tenantId, userId);

    // Combine the data
    return leadProductRelations.map(relation => {
      const product = products.find(p => p.id === relation.productId);
      return {
        id: relation.id,
        leadId: relation.leadId,
        productId: relation.productId,
        attachedAt: relation.attachedAt,
        createdAt: relation.createdAt,
        updatedAt: relation.updatedAt,
        product,
      };
    });
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
  tenantId: string,
  userId?: string
): Promise<LeadProduct[]> {
  try {
    const results: LeadProduct[] = [];
    
    // Attach each product using repository
    for (const productId of productIds) {
      try {
        // Check if already attached
        const existing = await leadProductRepository.findByLeadAndProduct(leadId, productId, tenantId, userId);
        if (!existing) {
          const newAttachment = await leadProductRepository.attachProductToLead(leadId, productId, tenantId, userId);
          results.push(newAttachment);
        }
      } catch (error) {
        console.warn(`Failed to attach product ${productId} to lead ${leadId}:`, error);
      }
    }

    return results;
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
  tenantId: string,
  userId?: string
): Promise<boolean> {
  try {
    await leadProductRepository.detachProductFromLead(leadId, productId, tenantId, userId);
    return true;
  } catch (error) {
    console.error('Error detaching product from lead:', error);
    return false;
  }
}

/**
 * Get the count of products attached to a lead
 */
export async function getLeadProductCount(leadId: string, tenantId: string, userId?: string): Promise<number> {
  try {
    const products = await leadProductRepository.findByLead(leadId, tenantId, userId);
    return products.length;
  } catch (error) {
    console.error('Error getting lead product count:', error);
    throw new Error('Failed to get lead product count');
  }
}
