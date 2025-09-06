import { authService } from './auth.service'

class GoogleService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  async getGoogleAuthUrl(): Promise<{ authUrl: string; state: string }> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(
      `${this.baseUrl}/third-party/google/authorize`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      },
    )

    if (!response.ok) {
      throw new Error('Failed to get Google auth URL')
    }

    const data = await response.json()

    if (!data.authUrl) {
      throw new Error('No authorization URL received')
    }

    return { authUrl: data.authUrl, state: data.state }
  }
}

export const googleService = new GoogleService()
