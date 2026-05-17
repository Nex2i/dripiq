import { authService } from './auth.service'

export type ZoomInfoIntegrationStatus = {
  configured: boolean
  clientIdMasked: string | null
}

class ZoomInfoIntegrationService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  async getStatus(): Promise<ZoomInfoIntegrationStatus> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/integrations/zoominfo`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to load ZoomInfo status')
    }
    return response.json()
  }

  async saveCredentials(
    clientId: string,
    clientSecret: string,
  ): Promise<ZoomInfoIntegrationStatus & { message: string }> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/integrations/zoominfo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ clientId, clientSecret }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.message || 'Failed to save ZoomInfo credentials')
    }
    return body
  }

  async testCredentials(
    clientId: string,
    clientSecret: string,
  ): Promise<{ ok: boolean; message: string }> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/integrations/zoominfo/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ clientId, clientSecret }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(body.message || 'ZoomInfo test failed')
    }
    return body
  }

  async disconnect(): Promise<void> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/integrations/zoominfo`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to remove ZoomInfo integration')
    }
  }
}

export const zoomInfoIntegrationService = new ZoomInfoIntegrationService()
