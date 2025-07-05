import { authService } from './auth.service'

export interface LogoUploadRequest {
  domain: string
  contentType: string
}

export interface LogoUploadResponse {
  signedUploadUrl: string
  storagePath: string
  publicUrl: string
}

export interface LogoDownloadResponse {
  signedUrl: string
  storagePath: string
}

const baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'

export const logoService = {
  // Get signed upload URL for logo
  getUploadUrl: async (
    request: LogoUploadRequest,
  ): Promise<LogoUploadResponse> => {
    try {
      const authHeaders = await authService.getAuthHeaders()

      const response = await fetch(baseUrl + '/logo/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to get upload URL')
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting upload URL:', error)
      throw error
    }
  },

  // Upload logo to signed URL
  uploadLogo: async (signedUrl: string, file: File): Promise<void> => {
    try {
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to upload logo')
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
      throw error
    }
  },

  // Complete logo upload flow
  uploadLogoComplete: async (domain: string, file: File): Promise<string> => {
    try {
      // Get signed upload URL
      const uploadResponse = await logoService.getUploadUrl({
        domain,
        contentType: file.type,
      })

      // Upload the file
      await logoService.uploadLogo(uploadResponse.signedUploadUrl, file)

      // Return the public URL
      return uploadResponse.publicUrl
    } catch (error) {
      console.error('Error in complete logo upload:', error)
      throw error
    }
  },
}
