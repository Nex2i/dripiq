import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { products, userTenants } from '../db/schema';
import type { Product, NewProduct } from '../db/schema';

export const ProductsService = {
  // Get all products for a tenant
  async getProducts(tenantId: string): Promise<Product[]> {
    const productsList = await db.query.products.findMany({
      where: eq(products.tenantId, tenantId),
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    return productsList;
  },

  // Get default products for a tenant (for internal use)
  async getDefaultProducts(tenantId: string): Promise<Product[]> {
    const defaultProducts = await db.query.products.findMany({
      where: and(eq(products.tenantId, tenantId), eq(products.isDefault, true)),
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });

    return defaultProducts;
  },

  // Get a single product by ID
  async getProduct(id: string): Promise<Product | null> {
    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    return product || null;
  },

  // Create a new product
  async createProduct(data: NewProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(data).returning();
    if (!newProduct) {
      throw new Error('Failed to create product');
    }
    return newProduct;
  },

  // Update a product
  async updateProduct(id: string, data: Partial<NewProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (!updatedProduct) {
      throw new Error('Failed to update product');
    }
    return updatedProduct;
  },

  // Delete a product
  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  },

  // Check if user has access to a tenant
  async checkUserAccess(userId: string, tenantId: string): Promise<boolean> {
    const userTenant = await db.query.userTenants.findFirst({
      where: and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)),
    });

    return !!userTenant;
  },

  // Get product with access check
  async getProductWithAccess(userId: string, productId: string): Promise<Product | null> {
    const product = await this.getProduct(productId);

    if (!product) {
      return null;
    }

    const hasAccess = await this.checkUserAccess(userId, product.tenantId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    return product;
  },
};
