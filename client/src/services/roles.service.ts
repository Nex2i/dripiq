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

class RolesService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  // Get all available roles
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

export const rolesService = new RolesService()
