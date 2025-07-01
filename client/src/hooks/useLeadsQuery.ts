import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  leadsService,
  type Lead,
  type CreateLeadData,
  type UpdateLeadData,
} from '../services/leads.service'

// Query keys for leads
export const leadQueryKeys = {
  all: ['leads'] as const,
  lists: () => [...leadQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) =>
    [...leadQueryKeys.lists(), filters] as const,
  details: () => [...leadQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadQueryKeys.details(), id] as const,
}

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
    mutationFn: (data: CreateLeadData) => leadsService.createLead(data),
    onMutate: async (newLeadData: CreateLeadData) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: leadQueryKeys.list() })

      // Snapshot the previous value
      const previousLeads = queryClient.getQueryData<Lead[]>(
        leadQueryKeys.list(),
      )

      // Optimistically update to the new value with default status
      const optimisticLead: Lead = {
        id: `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique temporary ID
        name: newLeadData.name,
        email: newLeadData.email,
        company: newLeadData.company || '',
        phone: newLeadData.phone || '',
        status: newLeadData.status || 'new', // Default status
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      queryClient.setQueryData<Lead[]>(leadQueryKeys.list(), (oldLeads) => {
        if (!oldLeads) return [optimisticLead]
        return [optimisticLead, ...oldLeads]
      })

      // Return a context object with the snapshotted value
      return { previousLeads }
    },
    onSuccess: (newLead: Lead) => {
      // Update the leads list cache with the actual new lead from server
      queryClient.setQueryData<Lead[]>(leadQueryKeys.list(), (oldLeads) => {
        if (!oldLeads) return [newLead]
        // Replace the optimistic lead with the real one
        return oldLeads.map((lead) =>
          lead.id.startsWith('optimistic-') ? newLead : lead,
        )
      })
    },
    onError: (error, newLeadData, context) => {
      console.error('Error creating lead:', error)
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(leadQueryKeys.list(), context?.previousLeads)
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

// Hook to invalidate leads data (useful for manual refresh)
export function useInvalidateLeads() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({
      queryKey: leadQueryKeys.all,
    })
  }
}
