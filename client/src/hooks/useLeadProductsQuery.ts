import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  leadProductsService,
  type AttachProductsRequest,
} from '../services/leadProducts.service'

export const LEAD_PRODUCTS_QUERY_KEY = 'leadProducts'

/**
 * Hook to get products attached to a lead
 */
export function useLeadProducts(leadId: string | undefined) {
  return useQuery({
    queryKey: [LEAD_PRODUCTS_QUERY_KEY, leadId],
    queryFn: () => leadProductsService.getLeadProducts(leadId!),
    enabled: !!leadId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to attach products to a lead
 */
export function useAttachProductsToLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: AttachProductsRequest }) =>
      leadProductsService.attachProductsToLead(leadId, data),
    onSuccess: (_, variables) => {
      // Invalidate the lead products query to refetch the updated list
      queryClient.invalidateQueries({
        queryKey: [LEAD_PRODUCTS_QUERY_KEY, variables.leadId],
      })
      
      // Also invalidate the lead detail query in case it includes product count
      queryClient.invalidateQueries({
        queryKey: ['lead', variables.leadId],
      })
    },
  })
}

/**
 * Hook to detach a product from a lead
 */
export function useDetachProductFromLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, productId }: { leadId: string; productId: string }) =>
      leadProductsService.detachProductFromLead(leadId, productId),
    onSuccess: (_, variables) => {
      // Invalidate the lead products query to refetch the updated list
      queryClient.invalidateQueries({
        queryKey: [LEAD_PRODUCTS_QUERY_KEY, variables.leadId],
      })
      
      // Also invalidate the lead detail query in case it includes product count
      queryClient.invalidateQueries({
        queryKey: ['lead', variables.leadId],
      })
    },
  })
}

/**
 * Hook to invalidate lead products queries
 */
export function useInvalidateLeadProducts() {
  const queryClient = useQueryClient()

  return (leadId?: string) => {
    if (leadId) {
      queryClient.invalidateQueries({
        queryKey: [LEAD_PRODUCTS_QUERY_KEY, leadId],
      })
    } else {
      queryClient.invalidateQueries({
        queryKey: [LEAD_PRODUCTS_QUERY_KEY],
      })
    }
  }
}