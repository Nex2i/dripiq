import { authService } from './auth.service'
import type { AttachedProduct } from '../types/lead.types'

export interface AttachProductsRequest {
  productIds: string[]
}

export interface AttachProductsResponse {
  success: boolean
  message: string
  attachedCount: number
  attachments: Array<{
    id: string
    leadId: string
    productId: string
    attachedAt: string
    createdAt: string
    updatedAt: string
  }>
}

export interface DetachProductResponse {
  success: boolean
  message: string
}

class LeadProductsService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  // Get all products attached to a lead
  async getLeadProducts(leadId: string): Promise<AttachedProduct[]> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads/${leadId}/products`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to get lead products: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching lead products:', error)
      throw error
    }
  }

  // Attach products to a lead
  async attachProductsToLead(
    leadId: string,
    data: AttachProductsRequest,
  ): Promise<AttachProductsResponse> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads/${leadId}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to attach products')
      }

      return response.json()
    } catch (error) {
      console.error('Error attaching products to lead:', error)
      throw error
    }
  }

  // Detach a product from a lead
  async detachProductFromLead(
    leadId: string,
    productId: string,
  ): Promise<DetachProductResponse> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(
        `${this.baseUrl}/leads/${leadId}/products/${productId}`,
        {
          method: 'DELETE',
          headers: {
            ...authHeaders,
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to detach product')
      }

      return response.json()
    } catch (error) {
      console.error('Error detaching product from lead:', error)
      throw error
    }
  }
}

export const leadProductsService = new LeadProductsService()
