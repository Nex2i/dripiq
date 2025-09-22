import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'
import type { Lead, LeadPointOfContact, LeadStatus } from '../types/lead.types'

// Re-export types for backward compatibility
export type { Lead, LeadPointOfContact, LeadStatus }

export interface CreateLeadData {
  name: string
  url: string
  status?: string
  ownerId?: string
  pointOfContacts?: Array<{
    name: string
    email: string
    phone?: string
    title?: string
    company?: string
  }>
}

export interface UpdateLeadData {
  name?: string
  url?: string
  status?: string
  summary?: string
  products?: string[]
  services?: string[]
  differentiators?: string[]
  targetMarket?: string
  tone?: string
  brandColors?: string[]
}

export interface BatchCreateLeadData {
  websites: string[]
  ownerId: string
}

export interface BatchCreateLeadResult {
  url: string
  success: boolean
  leadId?: string
  error?: string
  name?: string
}

export interface BatchCreateLeadResponse {
  message: string
  results: BatchCreateLeadResult[]
  summary: {
    total: number
    successful: number
    failed: number
  }
}

// Query keys for leads (centralized)
export const leadQueryKeys = {
  all: ['leads'] as const,
  lists: () => [...leadQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) =>
    [...leadQueryKeys.lists(), filters] as const,
  paginatedList: (search?: string, page?: number, limit?: number) =>
    [...leadQueryKeys.lists(), { search, page, limit }] as const,
  details: () => [...leadQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadQueryKeys.details(), id] as const,
}

class LeadsService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private queryClient: QueryClient | null = null

  constructor(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient
    }
  }

  // Get all leads - raw fetch for use with useQuery
  async getLeads(
    searchQuery?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ leads: Lead[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const authHeaders = await authService.getAuthHeaders()

    // Build URL with optional search and pagination parameters
    const url = new URL(`${this.baseUrl}/leads`)
    if (searchQuery && searchQuery.trim()) {
      url.searchParams.append('search', searchQuery.trim())
    }
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
      throw new Error(`Failed to fetch leads: ${response.statusText}`)
    }

    return response.json()
  }

  // Get a single lead by ID - raw fetch for use with useQuery
  async getLead(id: string): Promise<Lead> {
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
  }

  // Create a new lead
  async createLead(data: CreateLeadData): Promise<{ lead: Lead }> {
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

    const result = await response.json()

    // Update cache after successful creation if queryClient is available
    if (this.queryClient) {
      this.queryClient.setQueryData(
        leadQueryKeys.detail(result.lead.id),
        result.lead,
      )

      // Invalidate leads list to refresh
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Create multiple leads in batch
  async createLeadsBatch(
    data: BatchCreateLeadData,
  ): Promise<BatchCreateLeadResponse> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/leads/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to create leads in batch')
    }

    const result = await response.json()

    // Invalidate leads list to refresh after batch creation if queryClient is available
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Update an existing lead
  async updateLead(id: string, data: UpdateLeadData): Promise<Lead> {
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

    const result = await response.json()
    const updatedLead = result.lead || result // Handle both new format { message, lead } and legacy format

    // Update cache after successful update if queryClient is available
    if (this.queryClient) {
      this.queryClient.setQueryData(leadQueryKeys.detail(id), updatedLead)

      // Update leads list cache
      this.queryClient.setQueryData<Lead[]>(
        leadQueryKeys.list(),
        (oldLeads) => {
          if (!oldLeads) return [updatedLead]
          return oldLeads.map((lead) =>
            lead.id === updatedLead.id ? updatedLead : lead,
          )
        },
      )

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return updatedLead
  }

  // Delete a lead
  async deleteLead(id: string): Promise<void> {
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

    // Update cache after successful deletion if queryClient is available
    if (this.queryClient) {
      this.queryClient.setQueryData<Lead[]>(
        leadQueryKeys.list(),
        (oldLeads) => {
          if (!oldLeads) return []
          return oldLeads.filter((lead) => lead.id !== id)
        },
      )

      // Remove the individual lead cache
      this.queryClient.removeQueries({
        queryKey: leadQueryKeys.detail(id),
      })

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }
  }

  // Bulk delete leads
  async bulkDeleteLeads(
    ids: string[],
  ): Promise<{ deletedCount: number; deletedLeads: Lead[] }> {
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

    const result = await response.json()

    // Update cache after successful bulk deletion if queryClient is available
    if (this.queryClient) {
      this.queryClient.setQueryData<Lead[]>(
        leadQueryKeys.list(),
        (oldLeads) => {
          if (!oldLeads) return []
          return oldLeads.filter((lead) => !ids.includes(lead.id))
        },
      )

      // Remove individual lead caches
      ids.forEach((id) => {
        this.queryClient!.removeQueries({
          queryKey: leadQueryKeys.detail(id),
        })
      })

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Resync a lead
  async resyncLead(id: string): Promise<{ message: string; leadId: string }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/leads/${id}/resync`, {
      method: 'POST',
      headers: {
        ...authHeaders,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to resync lead')
    }

    const result = await response.json()

    // Invalidate and refetch lead data after resync if queryClient is available
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(id),
      })
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Vendor Fit a lead
  async vendorFitLead(
    id: string,
  ): Promise<{ message: string; leadId: string; report?: any }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/leads/${id}/vendor-fit`, {
      method: 'POST',
      headers: {
        ...authHeaders,
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to run vendor fit')
    }

    const result = await response.json()

    // Invalidate and refetch lead data after vendor fit if queryClient is available
    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(id),
      })
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Assign owner to a lead
  async assignLeadOwner(
    id: string,
    userId: string,
  ): Promise<{ message: string; lead: Lead }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/leads/${id}/assign-owner`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to assign lead owner')
    }

    const result = await response.json()

    // Update cache after successful assignment if queryClient is available
    if (this.queryClient) {
      this.queryClient.setQueryData(leadQueryKeys.detail(id), result.lead)

      // Update leads list cache
      this.queryClient.setQueryData<Lead[]>(
        leadQueryKeys.list(),
        (oldLeads) => {
          if (!oldLeads) return [result.lead]
          return oldLeads.map((lead) =>
            lead.id === result.lead.id ? result.lead : lead,
          )
        },
      )

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Update contact information
  async updateContact(
    leadId: string,
    contactId: string,
    contactData: Partial<
      Pick<LeadPointOfContact, 'name' | 'email' | 'phone' | 'title'>
    >,
  ): Promise<{ message: string; contact: LeadPointOfContact }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/${leadId}/contacts/${contactId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(contactData),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to update contact')
    }

    const result = await response.json()

    // Update cache after successful update if queryClient is available
    if (this.queryClient) {
      // Update the specific lead's contacts in the cache
      this.queryClient.setQueryData<Lead>(
        leadQueryKeys.detail(leadId),
        (oldLead) => {
          if (!oldLead || !oldLead.pointOfContacts) return oldLead
          return {
            ...oldLead,
            pointOfContacts: oldLead.pointOfContacts.map((contact) =>
              contact.id === contactId ? result.contact : contact,
            ),
          }
        },
      )

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Toggle contact manually reviewed status
  async toggleContactManuallyReviewed(
    leadId: string,
    contactId: string,
    manuallyReviewed: boolean,
  ): Promise<{ message: string; contact: LeadPointOfContact }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/${leadId}/contacts/${contactId}/manually-reviewed`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ manuallyReviewed }),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.message ||
          'Failed to update contact manually reviewed status',
      )
    }

    const result = await response.json()

    // Update cache after successful update if queryClient is available
    if (this.queryClient) {
      // Invalidate the lead detail to refresh the contact data
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadId),
      })

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Check if URL already exists for the tenant
  async checkUrlExists(url: string): Promise<{
    exists: boolean
    lead?: {
      id: string
      name: string
      url: string
    }
  }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/check-url?url=${encodeURIComponent(url)}`,
      {
        method: 'GET',
        headers: {
          ...authHeaders,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to check URL existence')
    }

    return response.json()
  }

  // Create a new contact for a lead
  async createContact(
    leadId: string,
    contactData: {
      name: string
      email: string
      phone?: string
      title?: string
    },
  ): Promise<{ message: string; contact: LeadPointOfContact }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}/leads/${leadId}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(contactData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to create contact')
    }

    const result = await response.json()

    // Update cache after successful creation if queryClient is available
    if (this.queryClient) {
      // Update the specific lead's contacts in the cache
      this.queryClient.setQueryData<Lead>(
        leadQueryKeys.detail(leadId),
        (oldLead) => {
          if (!oldLead) return oldLead
          return {
            ...oldLead,
            pointOfContacts: [
              ...(oldLead.pointOfContacts || []),
              result.contact,
            ],
          }
        },
      )

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }

  // Generate contact strategy and outreach plan for a contact
  async generateContactStrategy(
    leadId: string,
    contactId: string,
  ): Promise<{ success: boolean; message: string }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/${leadId}/contacts/${contactId}/contact-strategy`,
      {
        method: 'PUT',
        headers: {
          ...authHeaders,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        errorData.message || 'Failed to generate contact strategy',
      )
    }

    const result = await response.json()
    return result
  }

  // Get existing contact strategy for a contact
  async getContactStrategy(leadId: string, contactId: string): Promise<any> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/${leadId}/contacts/${contactId}/contact-strategy`,
      {
        method: 'GET',
        headers: {
          ...authHeaders,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to get contact strategy')
    }

    const result = await response.json()
    return result
  }

  // Update contact strategy with edited data
  async updateContactStrategy(
    leadId: string,
    contactId: string,
    updatedPlan: any,
  ): Promise<any> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/${leadId}/contacts/${contactId}/contact-strategy`,
      {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPlan),
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to update contact strategy')
    }

    const result = await response.json()
    return result
  }

  // Unsubscribe a contact from email communications
  async unsubscribeContact(
    leadId: string,
    contactId: string,
  ): Promise<{ message: string; unsubscribed: boolean }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/leads/${leadId}/contacts/${contactId}/unsubscribe`,
      {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
      },
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to unsubscribe contact')
    }

    const result = await response.json()

    // Update cache after successful unsubscribe if queryClient is available
    if (this.queryClient) {
      // Invalidate the lead detail to refresh the contact data
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadId),
      })

      // Invalidate leads list to ensure consistency
      this.queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    }

    return result
  }
}

// Create a singleton instance that will be initialized with QueryClient
let leadsServiceInstance: LeadsService | null = null

export const createLeadsService = (queryClient: QueryClient): LeadsService => {
  if (!leadsServiceInstance) {
    leadsServiceInstance = new LeadsService(queryClient)
  }
  return leadsServiceInstance
}

// Export a function to get the service instance
export const getLeadsService = (): LeadsService => {
  if (!leadsServiceInstance) {
    throw new Error(
      'LeadsService not initialized. Call createLeadsService() first.',
    )
  }
  return leadsServiceInstance
}

// Legacy export for backward compatibility - now creates a new instance without QueryClient for raw fetch operations
export const leadsService = new LeadsService()
