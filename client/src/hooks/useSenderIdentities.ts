import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { senderIdentitiesService, type CreateSenderIdentityData } from '../services/senderIdentities.service'

export const senderIdentityQueryKeys = {
  mine: ['sender-identities', 'me'] as const,
}

export function useMySenderIdentity() {
  return useQuery({
    queryKey: senderIdentityQueryKeys.mine,
    queryFn: () => senderIdentitiesService.getMine(),
  })
}

export function useCreateMySenderIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSenderIdentityData) => senderIdentitiesService.createMine(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.mine })
    },
  })
}

export function useResendMySenderVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => senderIdentitiesService.resendMine(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.mine })
    },
  })
}

export function useCheckMySenderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => senderIdentitiesService.checkMine(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.mine })
    },
  })
}

export function useRetryMySenderIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data?: Partial<CreateSenderIdentityData>) => senderIdentitiesService.retryMine(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.mine })
    },
  })
}

export function useVerifyMySenderIdentity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (value: string) => senderIdentitiesService.verifyMine(value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: senderIdentityQueryKeys.mine })
    },
  })
}