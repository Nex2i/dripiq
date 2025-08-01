import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { productRepository } from '@/repositories';
import type { Product, NewProduct } from '../db/schema';

export const ProductsService = {
  // Get all products for a tenant
  async getProducts(tenantId: string, userId?: string): Promise<Product[]> {
    return await productRepository.findByTenant(tenantId, userId);
  },

  // Get default products for a tenant (for internal use)
  async getDefaultProducts(tenantId: string, userId?: string): Promise<Product[]> {
    return await productRepository.findDefaultByTenant(tenantId, userId);
  },

  // Get a single product by ID
  async getProduct(id: string, tenantId: string, userId?: string): Promise<Product | null> {
    return await productRepository.findById(id, tenantId, userId);
  },

  // Create a new product
  async createProduct(data: NewProduct, tenantId: string, userId?: string): Promise<Product> {
    const newProduct = await productRepository.create(data, tenantId, userId);

    if (newProduct.siteUrl) {
      await firecrawlClient.batchScrapeUrls([newProduct.siteUrl]);
    }
    return newProduct;
  },

  // Update a product
  async updateProduct(id: string, data: Partial<NewProduct>, tenantId: string, userId?: string): Promise<Product> {
    const updatedProduct = await productRepository.update(id, data, tenantId, userId);

    if (updatedProduct.siteUrl) {
      await firecrawlClient.batchScrapeUrls([updatedProduct.siteUrl]);
    }
    return updatedProduct;
  },

  // Delete a product
  async deleteProduct(id: string, tenantId: string, userId?: string): Promise<void> {
    await productRepository.delete(id, tenantId, userId);
  },

  // Get product with access check
  async getProductWithAccess(userId: string, productId: string, tenantId: string): Promise<Product | null> {
    return await productRepository.findById(productId, tenantId, userId);
  },
};
