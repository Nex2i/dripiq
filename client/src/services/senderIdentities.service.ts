import { authService } from './auth.service'

export type SenderValidationStatus = 'pending' | 'verified' | 'failed'

export interface SenderIdentity {
  id: string
  tenantId: string
  userId: string
  fromEmail: string
  fromName: string
  domain: string
  sendgridSenderId?: string | null
  validationStatus: SenderValidationStatus
  lastValidatedAt?: string | null
  dedicatedIpPool?: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSenderIdentityData {
  fromEmail: string
  fromName: string
  domain?: string
  isDefault?: boolean
}

class SenderIdentitiesService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  async list(): Promise<SenderIdentity[]> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
    })
    if (!response.ok) throw new Error('Failed to fetch sender identities')
    return response.json()
  }

  async create(data: CreateSenderIdentityData): Promise<SenderIdentity> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error('Failed to create sender identity')
    return response.json()
  }

  async resend(id: string): Promise<{ message: string }> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/${id}/resend`, {
      method: 'POST',
      headers: { ...authHeaders },
    })
    if (!response.ok) throw new Error('Failed to resend verification')
    return response.json()
  }

  async check(id: string): Promise<SenderIdentity> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/${id}/check`, {
      method: 'POST',
      headers: { ...authHeaders },
    })
    if (!response.ok) throw new Error('Failed to check status')
    return response.json()
  }

  async setDefault(id: string): Promise<SenderIdentity> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/${id}/default`, {
      method: 'PATCH',
      headers: { ...authHeaders },
    })
    if (!response.ok) throw new Error('Failed to set default')
    return response.json()
  }

  async remove(id: string): Promise<{ message: string }> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
    })
    if (!response.ok) throw new Error('Failed to delete sender identity')
    return response.json()
  }
}

export const senderIdentitiesService = new SenderIdentitiesService()