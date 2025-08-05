import firecrawlClient from '@/libs/firecrawl/firecrawl.client';
import { productRepository, siteEmbeddingRepository } from '@/repositories';
import { firecrawlTypes } from '@/libs/firecrawl/firecrawl.metadata';
import type { Product, NewProduct } from '../db/schema';

// Helper function to ensure a site is scraped and embedded
const ensureSiteScraped = async (tenantId: string, siteUrl?: string | null): Promise<void> => {
  if (!siteUrl) {
    return;
  }

  if (await hasUrlBeenScraped(siteUrl)) {
    return;
  }

  await firecrawlClient.batchScrapeUrls([siteUrl], { type: firecrawlTypes.product, tenantId });
};

// Helper function to check if a URL has been scraped and embedded
const hasUrlBeenScraped = async (siteUrl: string): Promise<boolean> => {
  try {
    const cleanUrl = siteUrl.cleanWebsiteUrl();
    const embeddings = await siteEmbeddingRepository.findByUrl(cleanUrl);
    return embeddings.length > 0;
  } catch (_) {
    // If there's an error checking, err on the side of caution and scrape
    return false;
  }
};

export const ProductsService = {
  // Get all products for a tenant
  async getProducts(tenantId: string): Promise<Product[]> {
    const productsList = await productRepository.findByTenantId(tenantId);

    return productsList;
  },

  // Get default products for a tenant (for internal use)
  async getDefaultProducts(tenantId: string): Promise<Product[]> {
    const defaultProducts = await productRepository.findDefaultForTenant(tenantId);

    return defaultProducts;
  },

  // Get a single product by ID
  async getProduct(productId: string, tenantId: string): Promise<Product | null> {
    const product = await productRepository.findByIdForTenant(productId, tenantId);

    return product || null;
  },

  // Create a new product
  async createProduct(data: NewProduct, tenantId: string): Promise<Product> {
    const newProduct = await productRepository.createForTenantWithDefault(tenantId, data);
    if (!newProduct) {
      throw new Error('Failed to create product');
    }

    await ensureSiteScraped(tenantId, newProduct.siteUrl);

    return newProduct;
  },

  // Update a product
  async updateProduct(
    productId: string,
    data: Partial<NewProduct>,
    tenantId: string
  ): Promise<Product> {
    const updatedProduct = await productRepository.updateByIdForTenant(productId, tenantId, data);

    if (!updatedProduct) {
      throw new Error('Failed to update product');
    }

    await ensureSiteScraped(tenantId, updatedProduct.siteUrl);

    return updatedProduct;
  },

  // Delete a product
  async deleteProduct(productId: string, tenantId: string): Promise<void> {
    await productRepository.deleteByIdForTenant(productId, tenantId);
  },
};
