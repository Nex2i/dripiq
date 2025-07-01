import { authService } from './auth.service'

export interface User {
  id: string
  firstName?: string
  lastName?: string
  email: string
  role: string
  status: 'pending' | 'active' | 'expired'
  invitedAt?: string
  lastLogin?: string
  source: 'invite' | 'seat'
}

export interface CreateInviteData {
  firstName: string
  lastName?: string
  email: string
  role: 'owner' | 'manager' | 'rep'
  dailyCap?: number
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
    expiresAt: string
  }
}

export interface InviteVerificationResponse {
  message: string
  invite: {
    id: string
    email: string
    firstName: string
    lastName?: string
    role: string
    tenantId: string
    expiresAt: string
  }
}

export interface ApiError {
  message: string
  error?: string
}

class InvitesService {
  private baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8085') + '/api'

  // Get all users for a tenant (combines seats + invites)
  async getUsers(tenantId: string, page = 1, limit = 25): Promise<UsersResponse> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const url = new URL(`${this.baseUrl}/users`)
      url.searchParams.append('tenantId', tenantId)
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

  // Accept invitation
  async acceptInvite(token: string): Promise<{ message: string; invite: any; seat: any }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/invites/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to accept invitation')
      }

      return response.json()
    } catch (error) {
      console.error('Error accepting invite:', error)
      throw error
    }
  }

  // Resend invitation
  async resendInvite(inviteId: string): Promise<{ message: string; invite: any }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/invites/${inviteId}/resend`, {
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

  // Revoke invitation
  async revokeInvite(inviteId: string): Promise<{ message: string; invite: any }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.message || 'Failed to revoke invitation')
      }

      return response.json()
    } catch (error) {
      console.error('Error revoking invite:', error)
      throw error
    }
  }
}

export const invitesService = new InvitesService()