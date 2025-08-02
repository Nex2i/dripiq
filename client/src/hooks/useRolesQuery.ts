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

/**
 * Usage example:
 * 
 * import { useRoles } from '../hooks/useRolesQuery'
 * 
 * function MyComponent() {
 *   const { data: roles, isLoading, error } = useRoles()
 * 
 *   if (isLoading) return <div>Loading roles...</div>
 *   if (error) return <div>Error: {error.message}</div>
 * 
 *   return (
 *     <select>
 *       {roles?.map(role => (
 *         <option key={role.id} value={role.id}>
 *           {role.name}
 *         </option>
 *       ))}
 *     </select>
 *   )
 * }
 */