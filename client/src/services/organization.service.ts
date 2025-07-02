import { authService } from './auth.service'

export interface Organization {
  id: string
  tenantName: string
  organizationName: string
  organizationWebsite: string
}

export interface UpdateOrganizationData {
  name?: string
  organizationName?: string
  organizationWebsite?: string
}

class OrganizationService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  // Get organization details
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

      return response.json()
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

      return response.json()
    } catch (error) {
      console.error('Error resyncing organization:', error)
      throw error
    }
  }
}

export const organizationService = new OrganizationService()
