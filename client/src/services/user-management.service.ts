import { authService } from './auth.service'

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
}

export interface UserWithRole {
  id: string
  email: string
  name: string
  isActive: boolean
  role: Role
  tenantId: string
  isSuperUser: boolean
}

export interface UserPermissions {
  permissions: Permission[]
  role?: Role
  canInvite: boolean
  canManage: boolean
}

export interface InviteUserData {
  email: string
  name: string
  roleId: string
  tenantId: string
}

export interface UpdateUserRoleData {
  roleId: string
}

export interface UpdateUserStatusData {
  isActive: boolean
}

class UserManagementService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api/user-management'

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const authHeaders = await authService.getAuthHeaders()

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || 'Request failed')
    }

    return response.json()
  }

  // Get current user's permissions for a tenant
  async getUserPermissions(tenantId: string): Promise<UserPermissions> {
    return this.makeRequest<UserPermissions>(`/my-permissions/${tenantId}`)
  }

  // Get all users for a tenant
  async getTenantUsers(
    tenantId: string,
  ): Promise<{ data: { users: UserWithRole[] } }> {
    return this.makeRequest<{ data: { users: UserWithRole[] } }>(
      `/tenants/${tenantId}/users`,
    )
  }

  // Get all roles for a tenant
  async getTenantRoles(tenantId: string): Promise<{ roles: Role[] }> {
    return this.makeRequest<{ roles: Role[] }>(`/tenants/${tenantId}/roles`)
  }

  // Invite a new user
  async inviteUser(
    data: InviteUserData,
  ): Promise<{ message: string; tempPassword?: string }> {
    return this.makeRequest<{ message: string; tempPassword?: string }>(
      '/invite',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  }

  // Update user's role within a tenant
  async updateUserRole(
    tenantId: string,
    userId: string,
    data: UpdateUserRoleData,
  ): Promise<void> {
    return this.makeRequest<void>(`/tenants/${tenantId}/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  // Remove user from a tenant
  async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
    return this.makeRequest<void>(`/tenants/${tenantId}/users/${userId}`, {
      method: 'DELETE',
    })
  }

  // Toggle user active status
  async updateUserStatus(
    userId: string,
    data: UpdateUserStatusData,
  ): Promise<void> {
    return this.makeRequest<void>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }
}

export const userManagementService = new UserManagementService()
