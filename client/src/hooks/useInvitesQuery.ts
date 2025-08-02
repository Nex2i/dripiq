import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invitesService, inviteQueryKeys } from '../services/invites.service'
import type { CreateInviteData } from '../services/invites.service'

// Hook to get users with pagination
export function useUsers(page = 1, limit = 25) {
  return useQuery({
    queryKey: inviteQueryKeys.users({ page, limit }),
    queryFn: () => invitesService.getUsers(page, limit),
    staleTime: 1000 * 60, // Consider data stale after 1 minute
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Hook to get available roles
export function useRoles() {
  return useQuery({
    queryKey: inviteQueryKeys.roles(),
    queryFn: () => invitesService.getRoles(),
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Hook to create a new invite
export function useInviteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateInviteData) => {
      const result = await invitesService.createInvite(data)
      return result
    },
    onSuccess: () => {
      // Invalidate users queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: inviteQueryKeys.usersList(),
      })
    },
    onError: (error) => {
      console.error('Error creating invite:', error)
    },
  })
}

// Hook to update user role
export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const result = await invitesService.updateUserRole(userId, roleId)
      return result
    },
    onSuccess: () => {
      // Invalidate users queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: inviteQueryKeys.usersList(),
      })
    },
    onError: (error) => {
      console.error('Error updating user role:', error)
    },
  })
}

// Hook to resend invite
export function useResendInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await invitesService.resendInvite(userId)
      return result
    },
    onSuccess: () => {
      // Invalidate users queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: inviteQueryKeys.usersList(),
      })
    },
    onError: (error) => {
      console.error('Error resending invite:', error)
    },
  })
}

// Hook to remove user
export function useRemoveUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await invitesService.removeUser(userId)
      return result
    },
    onSuccess: () => {
      // Invalidate users queries to refresh the list
      queryClient.invalidateQueries({
        queryKey: inviteQueryKeys.usersList(),
      })
    },
    onError: (error) => {
      console.error('Error removing user:', error)
    },
  })
}

// Hook to invalidate invites data (useful for manual refresh)
export function useInvalidateInvites() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({
      queryKey: inviteQueryKeys.all,
    })
  }
}

// Re-export the query keys for use in other components
export { inviteQueryKeys }