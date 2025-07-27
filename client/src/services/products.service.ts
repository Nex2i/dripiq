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

class ProductsService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

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

      return response.json()
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

      return response.json()
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
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  }
}

export const productsService = new ProductsService()
