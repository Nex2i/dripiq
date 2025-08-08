import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'

export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...userQueryKeys.lists(), filters] as const,
  details: () => [...userQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...userQueryKeys.details(), id] as const,
  me: () => [...userQueryKeys.all, 'me'] as const,
}

export interface SimpleUser {
  id: string
  email: string
  name: string | null
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

  async updateMyProfile(name: string): Promise<{ message: string; user: SimpleUser }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ name }),
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
    name: string,
  ): Promise<{ message: string; user: SimpleUser }> {
    const authHeaders = await authService.getAuthHeaders()
    const res = await fetch(`${this.baseUrl}/users/${userId}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to update user')
    }
    const result = await res.json()

    if (this.queryClient) {
      this.queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(userId) })
      // Also invalidate lists based on existing invites list key
      try {
        const { inviteQueryKeys } = await import('./invites.service')
        this.queryClient.invalidateQueries({ queryKey: inviteQueryKeys.usersList() })
      } catch {}
    }

    return result
  }
}

let usersServiceInstance: UsersService | null = null

export const createUsersService = (queryClient: QueryClient): UsersService => {
  if (!usersServiceInstance) usersServiceInstance = new UsersService(queryClient)
  return usersServiceInstance
}

export const getUsersService = (): UsersService => {
  if (!usersServiceInstance) {
    throw new Error('UsersService not initialized. Call createUsersService() first.')
  }
  return usersServiceInstance
}

export const usersService = new UsersService()