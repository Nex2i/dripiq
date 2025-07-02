import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { organizationService } from '../services/organization.service'
import type {
  Organization,
  UpdateOrganizationData,
} from '../services/organization.service'

// Query keys for organizations
export const organizationQueryKeys = {
  all: ['organizations'] as const,
  details: () => [...organizationQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...organizationQueryKeys.details(), id] as const,
}

// Hook to get organization details
export function useOrganization(id: string) {
  return useQuery({
    queryKey: organizationQueryKeys.detail(id),
    queryFn: () => organizationService.getOrganization(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Hook to update organization
export function useUpdateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrganizationData }) =>
      organizationService.updateOrganization(id, data),
    onSuccess: (updatedOrganization: Organization) => {
      // Update the organization cache
      queryClient.setQueryData(
        organizationQueryKeys.detail(updatedOrganization.id),
        updatedOrganization,
      )

      // Invalidate organization cache to ensure consistency
      queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.all,
      })
    },
    onError: (error) => {
      console.error('Error updating organization:', error)
    },
  })
}

// Hook to resync organization details
export function useResyncOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => organizationService.resyncOrganization(id),
    onSuccess: (_, id) => {
      // Invalidate and refetch organization data
      queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.detail(id),
      })
      queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.all,
      })
    },
    onError: (error) => {
      console.error('Error resyncing organization:', error)
    },
  })
}

// Hook to invalidate organization data (useful for manual refresh)
export function useInvalidateOrganization() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({
      queryKey: organizationQueryKeys.all,
    })
  }
}
