import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'
import { inviteQueryKeys } from './invites.service'

export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) =>
    [...userQueryKeys.lists(), filters] as const,
  details: () => [...userQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...userQueryKeys.details(), id] as const,
  me: () => [...userQueryKeys.all, 'me'] as const,
  emailProviders: () => [...userQueryKeys.all, 'email-providers'] as const,
}

export interface SimpleUser {
  id: string
  email: string
  name: string | null
  calendarLink?: string | null
  calendarTieIn: string
}

export interface EmailProvider {
  id: string
  provider: string
  primaryEmail: string
  displayName: string
  isPrimary: boolean
  isConnected: boolean
  connectedAt: string
}

class UsersService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private queryClient: QueryClient | null = null

  constructor(queryClient?: QueryClient) {
    if (queryClient) this.queryClient = queryClient
  }

  async getUser(userId: string): Promise<SimpleUser> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to fetch user')
    }
    return res.json()
  }

  async updateMyProfile(profileData: {
    name: string
    calendarLink?: string
    calendarTieIn: string
  }): Promise<{ message: string; user: SimpleUser }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(profileData),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update profile')
    }
    const result = await res.json()

    // Invalidate/refresh auth user if we have a query client
    if (this.queryClient) {
      // Invalidate any user details caches that might depend on self
      this.queryClient.invalidateQueries({ queryKey: userQueryKeys.me() })
    }

    return result
  }

  async updateUserProfile(
    userId: string,
    profileData: { name: string; calendarLink?: string; calendarTieIn: string },
  ): Promise<{ message: string; user: SimpleUser }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/users/${userId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(profileData),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update user')
    }
    const result = await res.json()

    if (this.queryClient) {
      this.queryClient.invalidateQueries({
        queryKey: userQueryKeys.detail(userId),
      })
      // Also invalidate lists based on existing invites list key
      try {
        this.queryClient.invalidateQueries({
          queryKey: inviteQueryKeys.usersList(),
        })
      } catch {}
    }

    return result
  }

  async sendTestEmail(emailData: {
    recipientEmail: string
    subject: string
    body: string
  }): Promise<{ success: boolean; message: string; messageId?: string }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/users/test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(emailData),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to send test email')
    }
    return res.json()
  }

  async getEmailProviders(): Promise<{ providers: EmailProvider[] }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/me/email-providers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to fetch email providers')
    }
    return res.json()
  }

  async switchPrimaryProvider(providerId: string): Promise<{ message: string; provider: EmailProvider }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/me/email-providers/primary`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ providerId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to switch primary provider')
    }
    const result = await res.json()

    // Note: Cache invalidation is handled by the calling component's mutation
    // to avoid duplicate refetches and provide better UX with optimistic updates

    return result
  }
}

let usersServiceInstance: UsersService | null = null

export const createUsersService = (queryClient: QueryClient): UsersService => {
  if (!usersServiceInstance)
    usersServiceInstance = new UsersService(queryClient)
  return usersServiceInstance
}

export const getUsersService = (): UsersService => {
  if (!usersServiceInstance) {
    throw new Error(
      'UsersService not initialized. Call createUsersService() first.',
    )
  }
  return usersServiceInstance
}

export const usersService = new UsersService()
