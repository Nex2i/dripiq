import { useState } from 'react'
import {
  Plus,
  MoreVertical,
  Eye,
  RefreshCw,
  Trash2,
  Users,
  AlertCircle,
  Check,
  X,
  Edit3,
} from 'lucide-react'
import { InviteUserModal } from '../../components/InviteUserModal'
import {
  useUsers,
  useRoles,
  useUpdateUserRole,
  useResendInvite,
  useRemoveUser,
} from '../../hooks/useInvitesQuery'
import { useAuth } from '../../contexts/AuthContext'

export default function UsersPage() {
  const { user } = useAuth()
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<{
    userId: string
    currentRole: string
    newRoleId: string
  } | null>(null)
  const [pagination] = useState({
    page: 1,
    limit: 25,
  })

  // Fetch data using hooks
  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers,
  } = useUsers(pagination.page, pagination.limit)

  const {
    data: roles = [],
    isLoading: rolesLoading,
    error: rolesError,
  } = useRoles()

  // Mutation hooks
  const updateUserRoleMutation = useUpdateUserRole()
  const resendInviteMutation = useResendInvite()
  const removeUserMutation = useRemoveUser()

  // Derived state
  const users = usersResponse?.data || []
  const paginationData = usersResponse?.pagination || {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  }
  const loading = usersLoading || rolesLoading
  const error = usersError || rolesError
  const updatingRole = updateUserRoleMutation.isPending
    ? editingRole?.userId
    : null

  // Check if current user is admin
  const isAdmin = user?.tenants?.[0]?.role?.name === 'Admin'

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full'
    switch (status) {
      case 'active':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString))
  }

  const handleInviteSuccess = () => {
    setIsInviteModalOpen(false)
    // The cache will be automatically updated via the mutation
  }

  const handleResendInvite = (userId: string) => {
    resendInviteMutation.mutate(userId, {
      onSuccess: () => {
        console.log('Invite resent successfully')
      },
      onError: (err) => {
        console.error('Error resending invite:', err)
      },
    })
  }

  const handleRemoveUser = (userId: string) => {
    removeUserMutation.mutate(userId, {
      onSuccess: () => {
        console.log('User removed successfully')
      },
      onError: (err) => {
        console.error('Error removing user:', err)
      },
    })
  }

  const handleEditRole = (userId: string, currentRole: string) => {
    const currentRoleObj = roles.find((role) => role.name === currentRole)
    setEditingRole({
      userId,
      currentRole,
      newRoleId: currentRoleObj?.id || '',
    })
  }

  const handleRoleChange = (newRoleId: string) => {
    if (editingRole) {
      setEditingRole({
        ...editingRole,
        newRoleId,
      })
    }
  }

  const handleSaveRole = () => {
    if (!editingRole) return

    updateUserRoleMutation.mutate(
      { userId: editingRole.userId, roleId: editingRole.newRoleId },
      {
        onSuccess: () => {
          setEditingRole(null)
          console.log('User role updated successfully')
        },
        onError: (err) => {
          console.error('Error updating user role:', err)
        },
      },
    )
  }

  const handleCancelEdit = () => {
    setEditingRole(null)
  }

  const emptyState = users.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-gray-900">User Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin
              ? 'Manage team members and their access to your workspace'
              : 'View team members in your workspace'}
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          {isAdmin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Invite user
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div>
        {loading ? (
          // Loading state
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-600)] mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading users...</p>
          </div>
        ) : error ? (
          // Error state
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              Error loading users
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {error?.message || 'Unknown error'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => refetchUsers()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
              >
                Try again
              </button>
            </div>
          </div>
        ) : emptyState ? (
          // Empty state
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No team members yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin
                ? 'Get started by inviting your first teammate.'
                : 'No team members have been added to this workspace yet.'}
            </p>
            {isAdmin && (
              <div className="mt-6">
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary-500)]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Invite your first teammate
                </button>
              </div>
            )}
          </div>
        ) : (
          // Users table
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invited
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((userRow) => (
                      <tr key={userRow.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {userRow.firstName && userRow.lastName
                            ? `${userRow.firstName} ${userRow.lastName}`
                            : userRow.firstName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userRow.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {editingRole?.userId === userRow.id ? (
                            <div className="flex items-center space-x-2">
                              <select
                                value={editingRole.newRoleId}
                                onChange={(e) =>
                                  handleRoleChange(e.target.value)
                                }
                                className="block w-32 px-3 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] sm:text-sm"
                              >
                                {roles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={handleSaveRole}
                                disabled={updatingRole === userRow.id}
                                className="p-1 text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={updatingRole === userRow.id}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span>{userRow.role}</span>
                              {isAdmin && (
                                <button
                                  onClick={() =>
                                    handleEditRole(userRow.id, userRow.role)
                                  }
                                  className="p-1 text-gray-400 hover:text-gray-600"
                                  title="Edit role"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={getStatusBadge(userRow.status)}>
                            {userRow.status.charAt(0).toUpperCase() +
                              userRow.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(userRow.lastLogin)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(userRow.invitedAt)}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => (window.location.href = `/settings/users/${userRow.id}`)}
                                className="text-[var(--color-primary-600)] hover:text-blue-900 p-1"
                                title="Edit user"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {userRow.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleResendInvite(userRow.id)
                                    }
                                    className="text-green-600 hover:text-green-900 p-1"
                                    title="Resend invite"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveUser(userRow.id)}
                                    className="text-red-600 hover:text-red-900 p-1"
                                    title="Remove user"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              <button className="text-gray-400 hover:text-gray-600 p-1">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-between">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    Previous
                  </button>
                  <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-medium">
                        {(paginationData.page - 1) * paginationData.limit + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min(
                          paginationData.page * paginationData.limit,
                          paginationData.total,
                        )}
                      </span>{' '}
                      of{' '}
                      <span className="font-medium">
                        {paginationData.total}
                      </span>{' '}
                      results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                        Previous
                      </button>
                      <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-[var(--color-primary-50)] text-sm font-medium text-[var(--color-primary-600)]">
                        1
                      </button>
                      <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isAdmin && (
        <InviteUserModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </div>
  )
}
