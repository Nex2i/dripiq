import { authService } from './auth.service'

export interface Lead {
  id: string
  name: string
  email: string
  url: string
  company?: string
  phone?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateLeadData {
  name: string
  email: string
  url: string
  company?: string
  phone?: string
  status?: string
}

export interface UpdateLeadData {
  name?: string
  email?: string
  url?: string
  company?: string
  phone?: string
  status?: string
}

class LeadsService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  // Get all leads
  async getLeads(searchQuery?: string): Promise<Lead[]> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      // Build URL with optional search parameter
      const url = new URL(`${this.baseUrl}/leads`)
      if (searchQuery && searchQuery.trim()) {
        url.searchParams.append('search', searchQuery.trim())
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch leads: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching leads:', error)
      throw error
    }
  }

  // Get a single lead by ID
  async getLead(id: string): Promise<Lead> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch lead: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      console.error('Error fetching lead:', error)
      throw error
    }
  }

  // Create a new lead
  async createLead(data: CreateLeadData): Promise<{ lead: Lead }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create lead')
      }

      return response.json()
    } catch (error) {
      console.error('Error creating lead:', error)
      throw error
    }
  }

  // Update an existing lead
  async updateLead(id: string, data: UpdateLeadData): Promise<Lead> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update lead')
      }

      return response.json()
    } catch (error) {
      console.error('Error updating lead:', error)
      throw error
    }
  }

  // Delete a lead
  async deleteLead(id: string): Promise<void> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete lead')
      }
    } catch (error) {
      console.error('Error deleting lead:', error)
      throw error
    }
  }

  // Bulk delete leads
  async bulkDeleteLeads(
    ids: string[],
  ): Promise<{ deletedCount: number; deletedLeads: Lead[] }> {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(`${this.baseUrl}/leads/bulk`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ ids }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to delete leads')
      }

      return response.json()
    } catch (error) {
      console.error('Error bulk deleting leads:', error)
      throw error
    }
  }
}

export const leadsService = new LeadsService()
