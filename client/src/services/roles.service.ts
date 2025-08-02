import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'

export interface Role {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface RolesResponse {
  message: string
  roles: Role[]
}

export interface ApiError {
  message: string
  error?: string
}

// Query keys for roles (centralized)
export const rolesQueryKeys = {
  all: ['roles'] as const,
  lists: () => [...rolesQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) =>
    [...rolesQueryKeys.lists(), filters] as const,
}

class RolesService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  constructor(_queryClient?: QueryClient) {
    // QueryClient integration reserved for future use
    // Currently roles service only needs read operations
  }

  // Get all available roles - raw fetch for use with useQuery
  async getRoles(): Promise<Role[]> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/roles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to fetch roles')
      }

      const data: RolesResponse = await response.json()
      return data.roles
    } catch (error) {
      console.error('Error fetching roles:', error)
      throw error
    }
  }
}

// Create a singleton instance that will be initialized with QueryClient
let rolesServiceInstance: RolesService | null = null

export const createRolesService = (queryClient: QueryClient): RolesService => {
  if (!rolesServiceInstance) {
    rolesServiceInstance = new RolesService(queryClient)
  }
  return rolesServiceInstance
}

// Export a function to get the service instance
export const getRolesService = (): RolesService => {
  if (!rolesServiceInstance) {
    throw new Error(
      'RolesService not initialized. Call createRolesService() first.',
    )
  }
  return rolesServiceInstance
}

// Legacy export for backward compatibility - now creates a new instance without QueryClient for raw fetch operations
export const rolesService = new RolesService()
