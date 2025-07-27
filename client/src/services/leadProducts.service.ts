import type { AttachedProduct } from '../types/lead.types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

/**
 * Get all products attached to a lead
 */
export async function getLeadProducts(leadId: string): Promise<AttachedProduct[]> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to get lead products: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Attach products to a lead
 */
export async function attachProductsToLead(
  leadId: string,
  data: AttachProductsRequest
): Promise<AttachProductsResponse> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to attach products: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Detach a product from a lead
 */
export async function detachProductFromLead(
  leadId: string,
  productId: string
): Promise<DetachProductResponse> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/products/${productId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to detach product: ${response.statusText}`)
  }

  return response.json()
}