import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsService, leadQueryKeys } from '../services/leads.service'
import { invitesService } from '../services/invites.service'
import type { Lead } from '../types/lead.types'
import type {
  CreateLeadData,
  UpdateLeadData,
} from '../services/leads.service'

// Hook to get all leads
export function useLeads(searchQuery?: string) {
  return useQuery({
    queryKey: leadQueryKeys.list({ search: searchQuery }),
    queryFn: () => leadsService.getLeads(searchQuery),
    staleTime: 1000 * 60, // Consider data stale after 1 minute
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Hook to get a single lead
export function useLead(id: string) {
  return useQuery({
    queryKey: leadQueryKeys.detail(id),
    queryFn: () => leadsService.getLead(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })
}

// Hook to create a new lead
export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateLeadData) => {
      const { lead } = await leadsService.createLead(data)
      return lead
    },
    onMutate: async (_newLeadData: CreateLeadData) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: leadQueryKeys.lists() })

      // Snapshot the previous value - we'll invalidate all list queries after
      const previousLeads = queryClient.getQueryData<Lead[]>(
        leadQueryKeys.list(),
      )

      // Don't do optimistic updates for now to avoid cache key issues
      // The mutation will complete quickly and we'll invalidate to refresh

      // Return a context object with the snapshotted value
      return { previousLeads }
    },
    onSuccess: (newLead) => {
      // Simply invalidate all leads queries to refresh the data
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })

      // Also set the individual lead cache for immediate access
      queryClient.setQueryData(leadQueryKeys.detail(newLead.id), newLead)
    },
    onError: (error, newLeadData, context) => {
      console.error('Error creating lead:', error, newLeadData, context)
      // No need to rollback since we're not doing optimistic updates
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
  })
}

// Hook to update a lead
export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeadData }) =>
      leadsService.updateLead(id, data),
    onSuccess: (updatedLead: Lead) => {
      // Update the individual lead cache
      queryClient.setQueryData(
        leadQueryKeys.detail(updatedLead.id),
        updatedLead,
      )

      // Update the leads list cache
      queryClient.setQueryData<Lead[]>(leadQueryKeys.list(), (oldLeads) => {
        if (!oldLeads) return [updatedLead]
        return oldLeads.map((lead) =>
          lead.id === updatedLead.id ? updatedLead : lead,
        )
      })

      // Invalidate leads list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
    onError: (error) => {
      console.error('Error updating lead:', error)
    },
  })
}

// Hook to delete a lead
export function useDeleteLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => leadsService.deleteLead(id),
    onSuccess: (_, deletedId) => {
      // Remove the lead from the list cache
      queryClient.setQueryData<Lead[]>(leadQueryKeys.list(), (oldLeads) => {
        if (!oldLeads) return []
        return oldLeads.filter((lead) => lead.id !== deletedId)
      })

      // Remove the individual lead cache
      queryClient.removeQueries({
        queryKey: leadQueryKeys.detail(deletedId),
      })

      // Invalidate leads list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
    onError: (error) => {
      console.error('Error deleting lead:', error)
    },
  })
}

// Hook to bulk delete leads
export function useBulkDeleteLeads() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => leadsService.bulkDeleteLeads(ids),
    onSuccess: (data, deletedIds) => {
      // Remove the leads from the list cache
      console.log('data', data)
      console.log('deletedIds', deletedIds)
      queryClient.setQueryData<Lead[]>(leadQueryKeys.list(), (oldLeads) => {
        if (!oldLeads) return []
        return oldLeads.filter((lead) => !deletedIds.includes(lead.id))
      })

      // Remove individual lead caches
      deletedIds.forEach((id) => {
        queryClient.removeQueries({
          queryKey: leadQueryKeys.detail(id),
        })
      })

      // Invalidate leads list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
    onError: (error) => {
      console.error('Error bulk deleting leads:', error)
    },
  })
}

// Hook to resync a lead
export function useResyncLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => leadsService.resyncLead(id),
    onSuccess: (_, id) => {
      // Invalidate and refetch lead data
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(id),
      })
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
    onError: (error) => {
      console.error('Error resyncing lead:', error)
    },
  })
}

// Hook to assign owner to a lead
export function useAssignLeadOwner() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      leadsService.assignLeadOwner(id, userId),
    onSuccess: (data) => {
      // Update the individual lead cache
      queryClient.setQueryData(leadQueryKeys.detail(data.lead.id), data.lead)

      // Update the leads list cache
      queryClient.setQueryData<Lead[]>(leadQueryKeys.list(), (oldLeads) => {
        if (!oldLeads) return [data.lead]
        return oldLeads.map((lead) =>
          lead.id === data.lead.id ? data.lead : lead,
        )
      })

      // Invalidate leads list to ensure consistency
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
    onError: (error) => {
      console.error('Error assigning lead owner:', error)
    },
  })
}

// Hook to invalidate leads data (useful for manual refresh)
export function useInvalidateLeads() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({
      queryKey: leadQueryKeys.all,
    })
  }
}

// Hook to vendor fit a lead
export function useVendorFitLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => leadsService.vendorFitLead(id),
    onSuccess: (_, id) => {
      // Invalidate and refetch lead data
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(id),
      })
      queryClient.invalidateQueries({
        queryKey: leadQueryKeys.lists(),
      })
    },
    onError: (error) => {
      console.error('Error running vendor fit:', error)
    },
  })
}

// Hook to get users for the current tenant
export function useUsers(page = 1, limit = 25) {
  return useQuery({
    queryKey: ['users', { page, limit }],
    queryFn: () => invitesService.getUsers(page, limit),
    staleTime: 1000 * 60 * 5, // Consider data stale after 5 minutes
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

// Re-export the query keys for use in other components
export { leadQueryKeys }
