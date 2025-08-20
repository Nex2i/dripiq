import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'

export interface Organization {
  id: string
  tenantName: string
  organizationName: string
  organizationWebsite: string
  summary: string
  products: string[]
  services: string[]
  differentiators: string[]
  targetMarket: string
  tone: string
  logo?: string | null
  brandColors?: string[]
}

export interface UpdateOrganizationData {
  name?: string
  organizationName?: string
  organizationWebsite?: string
  summary?: string
  products?: string[]
  services?: string[]
  differentiators?: string[]
  targetMarket?: string
  tone?: string
  logo?: string | null
  brandColors?: string[]
}

// Query keys for organizations (centralized)
export const organizationQueryKeys = {
  all: ['organizations'] as const,
  details: () => [...organizationQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationQueryKeys.details(), id] as const,
}

class OrganizationService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private queryClient: QueryClient | null = null

  constructor(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient
    }
  }

  // Get organization details - raw fetch for use with useQuery
  async getOrganization(id: string): Promise<Organization> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/organizations/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch organization: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching organization:', error)
      throw error
    }
  }

  // Update organization details
  async updateOrganization(
    id: string,
    data: UpdateOrganizationData,
  ): Promise<Organization> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/organizations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update organization')
      }

      const updatedOrganization = await response.json()

      // Update cache after successful update if queryClient is available
      if (this.queryClient) {
        this.queryClient.setQueryData(
          organizationQueryKeys.detail(id),
          updatedOrganization,
        )

        // Invalidate organization cache to ensure consistency
        this.queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.all,
        })
      }

      return updatedOrganization
    } catch (error) {
      console.error('Error updating organization:', error)
      throw error
    }
  }

  // Resync organization details
  async resyncOrganization(
    id: string,
  ): Promise<{ message: string; id: string }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(
        `${this.baseUrl}/organizations/${id}/resync`,
        {
          method: 'POST',
          headers: {
            ...authHeaders,
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to resync organization')
      }

      const result = await response.json()

      // Invalidate and refetch organization data after resync if queryClient is available
      if (this.queryClient) {
        this.queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.detail(id),
        })
        this.queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.all,
        })
      }

      return result
    } catch (error) {
      console.error('Error resyncing organization:', error)
      throw error
    }
  }
}

// Create a singleton instance that will be initialized with QueryClient
let organizationServiceInstance: OrganizationService | null = null

export const createOrganizationService = (
  queryClient: QueryClient,
): OrganizationService => {
  if (!organizationServiceInstance) {
    organizationServiceInstance = new OrganizationService(queryClient)
  }
  return organizationServiceInstance
}

// Export a function to get the service instance
export const getOrganizationService = (): OrganizationService => {
  if (!organizationServiceInstance) {
    throw new Error(
      'OrganizationService not initialized. Call createOrganizationService() first.',
    )
  }
  return organizationServiceInstance
}

// Legacy export for backward compatibility - now creates a new instance without QueryClient for raw fetch operations
export const organizationService = new OrganizationService()
