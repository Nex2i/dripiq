import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { senderIdentitiesService, type CreateSenderIdentityData } from '../services/senderIdentities.service'

export const senderIdentityQueryKeys = {
  all: ['sender-identities'] as const,
  list: () => [...senderIdentityQueryKeys.all, 'list'] as const,
}

export function useSenderIdentities() {
  return useQuery({
    queryKey: senderIdentityQueryKeys.list(),
    queryFn: () => senderIdentitiesService.list(),
  })
}

export function useCreateSenderIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSenderIdentityData) => senderIdentitiesService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.list() })
    },
  })
}

export function useResendSenderVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => senderIdentitiesService.resend(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.list() })
    },
  })
}

export function useCheckSenderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => senderIdentitiesService.check(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.list() })
    },
  })
}

export function useSetDefaultSender() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => senderIdentitiesService.setDefault(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.list() })
    },
  })
}

export function useRemoveSenderIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => senderIdentitiesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.list() })
    },
  })
}