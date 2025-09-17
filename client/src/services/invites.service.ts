import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'

// Query keys for invites (centralized)
export const inviteQueryKeys = {
  all: ['invites'] as const,
  usersList: () => [...inviteQueryKeys.all, 'users'] as const,
  users: (filters?: Record<string, any>) =>
    [...inviteQueryKeys.usersList(), filters] as const,
  roles: () => [...inviteQueryKeys.all, 'roles'] as const,
}

export interface User {
  id: string
  firstName?: string
  lastName?: string
  email: string
  role: string
  status: 'pending' | 'active'
  invitedAt?: string
  lastLogin?: string
  source: 'user_tenant'
  hasActivePrimaryMailAccount?: boolean
}

export interface CreateInviteData {
  firstName: string
  lastName?: string
  email: string
  role: string
}

export interface UsersResponse {
  success: boolean
  data: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface InviteResponse {
  message: string
  invite: {
    id: string
    email: string
    role: string
    status: string
    invitedAt: string
  }
}

export interface ApiError {
  message: string
  error?: string
}

export interface Role {
  id: string
  name: string
  description?: string
}

export interface RolesResponse {
  message: string
  roles: Role[]
}

class InvitesService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private queryClient: QueryClient | null = null

  constructor(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient
    }
  }

  // Get all users for a tenant
  async getUsers(page = 1, limit = 25): Promise<UsersResponse> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const url = new URL(`${this.baseUrl}/users`)
      url.searchParams.append('page', page.toString())
      url.searchParams.append('limit', limit.toString())

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to fetch users')
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching users:', error)
      throw error
    }
  }

  // Create a new invitation
  async createInvite(data: CreateInviteData): Promise<InviteResponse> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to send invitation')
      }

      const result = await response.json()

      // Update cache after successful creation if queryClient is available
      if (this.queryClient) {
        // Invalidate users list to refresh
        this.queryClient.invalidateQueries({
          queryKey: inviteQueryKeys.usersList(),
        })
      }

      return result
    } catch (error) {
      console.error('Error creating invite:', error)
      throw error
    }
  }

  // Activate user account when they set their password
  async activateUser(supabaseId: string): Promise<{
    message: string
    userTenant: {
      id: string
      tenantId: string
      roleId: string
      status: string
      acceptedAt: string
    }
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/invites/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ supabaseId }),
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to activate user account')
      }

      return response.json()
    } catch (error) {
      console.error('Error activating user:', error)
      throw error
    }
  }

  // Resend invitation
  async resendInvite(
    userId: string,
  ): Promise<{ message: string; userTenant: any }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/users/${userId}/resend`, {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to resend invitation')
      }

      const result = await response.json()

      // Update cache after successful resend if queryClient is available
      if (this.queryClient) {
        // Invalidate users list to refresh
        this.queryClient.invalidateQueries({
          queryKey: inviteQueryKeys.usersList(),
        })
      }

      return result
    } catch (error) {
      console.error('Error resending invite:', error)
      throw error
    }
  }

  // Remove user from tenant
  async removeUser(userId: string): Promise<{ message: string }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to remove user')
      }

      const result = await response.json()

      // Update cache after successful removal if queryClient is available
      if (this.queryClient) {
        // Invalidate users list to refresh
        this.queryClient.invalidateQueries({
          queryKey: inviteQueryKeys.usersList(),
        })
      }

      return result
    } catch (error) {
      console.error('Error removing user:', error)
      throw error
    }
  }

  // Update user role
  async updateUserRole(
    userId: string,
    roleId: string,
  ): Promise<{ message: string; userTenant: any }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ roleId }),
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to update user role')
      }

      const result = await response.json()

      // Update cache after successful update if queryClient is available
      if (this.queryClient) {
        // Invalidate users list to refresh
        this.queryClient.invalidateQueries({
          queryKey: inviteQueryKeys.usersList(),
        })
      }

      return result
    } catch (error) {
      console.error('Error updating user role:', error)
      throw error
    }
  }

  // Get available roles
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
let invitesServiceInstance: InvitesService | null = null

export const createInvitesService = (
  queryClient: QueryClient,
): InvitesService => {
  if (!invitesServiceInstance) {
    invitesServiceInstance = new InvitesService(queryClient)
  }
  return invitesServiceInstance
}

// Export a function to get the service instance
export const getInvitesService = (): InvitesService => {
  if (!invitesServiceInstance) {
    throw new Error(
      'InvitesService not initialized. Call createInvitesService() first.',
    )
  }
  return invitesServiceInstance
}

// Legacy export for backward compatibility - now creates a new instance without QueryClient for raw fetch operations
export const invitesService = new InvitesService()
