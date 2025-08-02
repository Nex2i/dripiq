import { useQuery } from '@tanstack/react-query'
import { rolesService, rolesQueryKeys } from '../services/roles.service'

// Hook to get all roles
export function useRoles() {
  return useQuery({
    queryKey: rolesQueryKeys.all,
    queryFn: () => rolesService.getRoles(),
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes (roles don't change often)
    refetchOnMount: false, // Roles rarely change, so don't refetch on every mount
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })
}
