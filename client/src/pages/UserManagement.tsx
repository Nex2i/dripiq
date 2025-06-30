import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  userManagementService,
  type Permission,
  type Role,
  type UserWithRole,
  type UserPermissions,
} from '@/services/user-management.service'

const UserManagement: React.FC = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [userPermissions, setUserPermissions] =
    useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    roleId: '',
  })

  // Get current tenant ID from user context
  const currentTenantId = user?.tenants?.[0]?.id

  useEffect(() => {
    if (currentTenantId) {
      loadData()
    }
  }, [currentTenantId])

  const loadData = async () => {
    if (!currentTenantId) return

    setLoading(true)
    setError(null)

    try {
      // Load user permissions
      const permissionsData =
        await userManagementService.getUserPermissions(currentTenantId)
      setUserPermissions(permissionsData)

      // Only load other data if user has permission to read users
      if (
        permissionsData.permissions.some(
          (p: Permission) => p.name === 'users:read',
        )
      ) {
        // Load users and roles in parallel
        const [usersData, rolesData] = await Promise.all([
          userManagementService.getTenantUsers(currentTenantId),
          userManagementService.getTenantRoles(currentTenantId),
        ])

        setUsers(usersData.data.users)
        setRoles(rolesData.roles)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentTenantId) return

    try {
      const result = await userManagementService.inviteUser({
        ...inviteForm,
        tenantId: currentTenantId,
      })

      // Show temporary password if provided
      if (result.tempPassword) {
        alert(
          `User invited successfully!\nTemporary password: ${result.tempPassword}\nPlease share this with the user securely.`,
        )
      } else {
        alert(result.message)
      }

      setShowInviteModal(false)
      setInviteForm({ email: '', name: '', roleId: '' })
      loadData() // Reload users
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    if (!currentTenantId) return

    try {
      await userManagementService.updateUserRole(currentTenantId, userId, {
        roleId: newRoleId,
      })

      loadData() // Reload users
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!currentTenantId) return

    if (
      !confirm(`Are you sure you want to remove ${userName} from this tenant?`)
    ) {
      return
    }

    try {
      await userManagementService.removeUserFromTenant(currentTenantId, userId)

      loadData() // Reload users
    } catch (err: any) {
      setError(err.message)
    }
  }

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await userManagementService.updateUserStatus(userId, {
        isActive: !currentStatus,
      })

      loadData() // Reload users
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading user management...</div>
      </div>
    )
  }

  if (!userPermissions) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Failed to load permissions</div>
      </div>
    )
  }

  const canReadUsers = userPermissions.permissions.some(
    (p) => p.name === 'users:read',
  )
  const canInvite = userPermissions.canInvite
  const canManage = userPermissions.canManage

  if (!canReadUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">
          You don't have permission to view users
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        {canInvite && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Invite User
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Current User's Role and Permissions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">
          Your Role & Permissions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-blue-700">
              <strong>Role:</strong>{' '}
              {userPermissions.role?.name || 'No role assigned'}
            </p>
            <p className="text-sm text-blue-700">
              <strong>Can Invite Users:</strong> {canInvite ? 'Yes' : 'No'}
            </p>
            <p className="text-sm text-blue-700">
              <strong>Can Manage Users:</strong> {canManage ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-sm text-blue-700 mb-1">
              <strong>Permissions:</strong>
            </p>
            <div className="flex flex-wrap gap-1">
              {userPermissions.permissions.map((permission) => (
                <span
                  key={permission.id}
                  className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                >
                  {permission.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Users ({users.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Super User
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.name || user.email}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {canManage ? (
                      <select
                        value={user.role.id}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-gray-900">
                        {user.role.name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isSuperUser
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.isSuperUser ? 'Yes' : 'No'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() =>
                            toggleUserStatus(user.id, user.isActive)
                          }
                          className={`px-3 py-1 rounded text-xs ${
                            user.isActive
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() =>
                            handleRemoveUser(user.id, user.name || user.email)
                          }
                          className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite New User</h3>
            <form onSubmit={handleInviteUser}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, name: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  required
                  value={inviteForm.roleId}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, roleId: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Select a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
