import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  schedulingQueryKeys,
  schedulingService,
  type SchedulingSettingsUpdate,
} from '../services/scheduling.service'

export function useSchedulingSettings(enabled = true) {
  return useQuery({
    queryKey: schedulingQueryKeys.settings(),
    queryFn: () => schedulingService.getSettings(),
    enabled,
    staleTime: 1000 * 60,
  })
}

export function useUpdateSchedulingSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SchedulingSettingsUpdate) =>
      schedulingService.updateSettings(data),
    onSuccess: (settings) => {
      queryClient.setQueryData(schedulingQueryKeys.settings(), settings)
      queryClient.invalidateQueries({ queryKey: schedulingQueryKeys.settings() })
    },
  })
}

export function usePublicBookingContext(token: string) {
  return useQuery({
    queryKey: schedulingQueryKeys.publicContext(token),
    queryFn: () => schedulingService.getPublicBookingContext(token),
    enabled: !!token,
    staleTime: 1000 * 60,
  })
}

export function useAvailability(token: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: schedulingQueryKeys.availability(token, startDate, endDate),
    queryFn: () => schedulingService.getAvailability(token, startDate, endDate),
    enabled: !!token && !!startDate && !!endDate,
    staleTime: 1000 * 15,
  })
}

export function useHoldSlot() {
  return useMutation({
    mutationFn: ({ token, slot }: { token: string; slot: string }) =>
      schedulingService.holdSlot(token, slot),
  })
}

export function useConfirmBooking() {
  return useMutation({
    mutationFn: (input: {
      token: string
      holdId: string
      slot: string
      contactDetails: { name: string; email: string; phone?: string }
    }) => schedulingService.confirmBooking(input),
  })
}
