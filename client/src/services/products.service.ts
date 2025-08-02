import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'

export interface Product {
  id: string
  title: string
  description?: string
  salesVoice?: string
  siteUrl?: string
  isDefault: boolean
  tenantId: string
  createdAt: string
  updatedAt: string
}

export interface CreateProductData {
  title: string
  description?: string
  salesVoice?: string
  siteUrl?: string
  isDefault?: boolean
}

export interface UpdateProductData {
  title?: string
  description?: string
  salesVoice?: string
  siteUrl?: string
  isDefault?: boolean
}

// Query keys for products (centralized)
export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (tenantId?: string) => [...productQueryKeys.lists(), tenantId] as const,
  details: () => [...productQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productQueryKeys.details(), id] as const,
}

class ProductsService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private queryClient: QueryClient | null = null

  constructor(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient
    }
  }

  // Get all products for a tenant
  async getProducts(): Promise<Product[]> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/products`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching products:', error)
      throw error
    }
  }

  // Get a single product by ID
  async getProduct(id: string): Promise<Product> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/products/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch product: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching product:', error)
      throw error
    }
  }

  // Create a new product
  async createProduct(
    tenantId: string,
    data: CreateProductData,
  ): Promise<Product> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          ...data,
          tenantId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create product')
      }

      const newProduct = await response.json()

      // Update cache after successful creation if queryClient is available
      if (this.queryClient) {
        this.queryClient.setQueryData(
          productQueryKeys.detail(newProduct.id),
          newProduct,
        )

        // Update products list cache
        this.queryClient.setQueryData<Product[]>(
          productQueryKeys.list(tenantId),
          (oldProducts) => {
            if (!oldProducts) return [newProduct]
            return [...oldProducts, newProduct]
          },
        )

        // Invalidate products list to refresh
        this.queryClient.invalidateQueries({
          queryKey: productQueryKeys.lists(),
        })
      }

      return newProduct
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  }

  // Update a product
  async updateProduct(id: string, data: UpdateProductData): Promise<Product> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update product')
      }

      const updatedProduct = await response.json()

      // Update cache after successful update if queryClient is available
      if (this.queryClient) {
        this.queryClient.setQueryData(productQueryKeys.detail(id), updatedProduct)

        // Update products list cache
        this.queryClient.setQueryData<Product[]>(
          productQueryKeys.list(updatedProduct.tenantId),
          (oldProducts) => {
            if (!oldProducts) return [updatedProduct]
            return oldProducts.map((product) =>
              product.id === updatedProduct.id ? updatedProduct : product,
            )
          },
        )

        // Invalidate products list to ensure consistency
        this.queryClient.invalidateQueries({
          queryKey: productQueryKeys.lists(),
        })
      }

      return updatedProduct
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  }

  // Delete a product
  async deleteProduct(id: string): Promise<void> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/products/${id}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete product')
      }

      // Update cache after successful deletion if queryClient is available
      if (this.queryClient) {
        this.queryClient.setQueriesData(
          { queryKey: productQueryKeys.lists() },
          (oldProducts: Product[] | undefined) => {
            if (!oldProducts) return []
            return oldProducts.filter((product) => product.id !== id)
          },
        )

        // Remove the individual product cache
        this.queryClient.removeQueries({
          queryKey: productQueryKeys.detail(id),
        })

        // Invalidate products list to ensure consistency
        this.queryClient.invalidateQueries({
          queryKey: productQueryKeys.lists(),
        })
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }
}

// Create a singleton instance that will be initialized with QueryClient
let productsServiceInstance: ProductsService | null = null

export const createProductsService = (queryClient: QueryClient): ProductsService => {
  if (!productsServiceInstance) {
    productsServiceInstance = new ProductsService(queryClient)
  }
  return productsServiceInstance
}

// Export a function to get the service instance
export const getProductsService = (): ProductsService => {
  if (!productsServiceInstance) {
    throw new Error(
      'ProductsService not initialized. Call createProductsService() first.',
    )
  }
  return productsServiceInstance
}

// Legacy export for backward compatibility - now creates a new instance without QueryClient for raw fetch operations
export const productsService = new ProductsService()
