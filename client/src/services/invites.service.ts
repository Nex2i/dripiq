import { authService } from './auth.service'

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

export interface InviteVerificationResponse {
  message: string
  userTenant: {
    id: string
    tenantId: string
    roleId: string
    status: string
    invitedAt: string
  }
}

export interface ApiError {
  message: string
  error?: string
}

class InvitesService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

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

      return response.json()
    } catch (error) {
      console.error('Error creating invite:', error)
      throw error
    }
  }

  // Verify invitation token
  async verifyInvite(token: string): Promise<InviteVerificationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/invites/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to verify invitation')
      }

      return response.json()
    } catch (error) {
      console.error('Error verifying invite:', error)
      throw error
    }
  }

  // Activate user account (when they complete password setup)
  async activateUser(token: string): Promise<{
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
        body: JSON.stringify({ token }),
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
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to resend invitation')
      }

      return response.json()
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

      return response.json()
    } catch (error) {
      console.error('Error removing user:', error)
      throw error
    }
  }
}

export const invitesService = new InvitesService()
