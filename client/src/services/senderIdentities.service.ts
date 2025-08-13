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
  address: string
  city: string
  country?: string
}

class SenderIdentitiesService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  private async throwDetailedError(response: Response, fallback: string): Promise<never> {
    try {
      const data = await response.json().catch(() => null as any)
      const errors = Array.isArray(data?.errors)
        ? data.errors
            .map((e: any) => {
              const field = typeof e?.field === 'string' && e.field ? `${e.field}: ` : ''
              const message = typeof e?.message === 'string' ? e.message : String(e)
              return `${field}${message}`
            })
            .filter(Boolean)
        : []
      const message = errors.length
        ? errors.join(', ')
        : (typeof data?.message === 'string' && data.message) || fallback
      throw new Error(message)
    } catch {
      throw new Error(fallback)
    }
  }

  async getMine(): Promise<SenderIdentity | null> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/me`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
    })
    if (response.status === 204) return null
    if (!response.ok) return this.throwDetailedError(response, 'Failed to fetch my sender identity')
    return response.json()
  }

  async createMine(data: CreateSenderIdentityData): Promise<SenderIdentity> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/me`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(data),
    })
    if (!response.ok) return this.throwDetailedError(response, 'Failed to create sender identity')
    return response.json()
  }

  async resendMine(): Promise<{ message: string }> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(
      `${this.baseUrl}/sender-identities/me/resend`,
      {
        method: 'POST',
        headers: { ...authHeaders },
      },
    )
    if (!response.ok) return this.throwDetailedError(response, 'Failed to resend verification')
    return response.json()
  }

  async retryMine(
    data?: Partial<CreateSenderIdentityData>,
  ): Promise<SenderIdentity> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/sender-identities/me/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(data ?? {}),
    })
    if (!response.ok) return this.throwDetailedError(response, 'Failed to retry sender identity')
    return response.json()
  }

  async verifyMine(sendgridValidationUrl: string): Promise<SenderIdentity> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(
      `${this.baseUrl}/sender-identities/me/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ sendgridValidationUrl }),
      },
    )
    if (!response.ok) return this.throwDetailedError(response, 'Failed to verify sender identity')
    return response.json()
  }
}

export const senderIdentitiesService = new SenderIdentitiesService()
