class OtpService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

  async verifyOtp(data: {
    email: string
    otp: string
    type: 'signup' | 'recovery'
  }): Promise<{ message: string; redirectUrl: string }> {
    const response = await fetch(`${this.baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to verify OTP')
    }

    return response.json()
  }
}

export const otpService = new OtpService()
