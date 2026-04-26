import type { QueryClient } from '@tanstack/react-query'
import { authService } from './auth.service'

export interface WorkingHourRange {
  start: string
  end: string
}

export type WorkingHours = Record<
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday',
  WorkingHourRange[]
>

export interface SchedulingSettings {
  id: string
  tenantId: string
  userId: string
  timezone: string
  workingHours: WorkingHours
  meetingDurationMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minNoticeMinutes: number
  bookingHorizonDays: number
  respectFreeBusy: boolean
}

export type SchedulingSettingsUpdate = Partial<
  Omit<SchedulingSettings, 'id' | 'tenantId' | 'userId'>
>

export interface PublicBookingContext {
  tokenId: string
  timezone: string
  meetingDurationMinutes: number
  lead: {
    id: string
    name: string
    url: string
  }
  contact: {
    id: string
    name: string
    email?: string
    phone?: string
    company?: string
  }
}

export interface AvailabilityResponse {
  availableSlots: string[]
  busyBlocks: Array<{ start: string; end: string }>
  timezone: string
}

export interface ScheduleHoldResponse {
  holdId: string
  expiresAt: string
}

export interface ScheduleConfirmResponse {
  meetingId: string
  calendarEventLink?: string
}

export const schedulingQueryKeys = {
  all: ['scheduling'] as const,
  settings: () => [...schedulingQueryKeys.all, 'settings'] as const,
  publicContext: (token: string) =>
    [...schedulingQueryKeys.all, 'public-context', token] as const,
  availability: (token: string, start: string, end: string) =>
    [...schedulingQueryKeys.all, 'availability', token, start, end] as const,
}

class SchedulingService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL + '/api'
  private queryClient: QueryClient | null = null

  constructor(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient
    }
  }

  async getSettings(): Promise<SchedulingSettings> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/schedule/settings`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    })

    return this.parseResponse(response, 'Failed to fetch scheduling settings')
  }

  async updateSettings(
    data: SchedulingSettingsUpdate,
  ): Promise<SchedulingSettings> {
    const authHeaders = await authService.getAuthHeaders()
    const response = await fetch(`${this.baseUrl}/schedule/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(data),
    })

    const settings = await this.parseResponse<SchedulingSettings>(
      response,
      'Failed to update scheduling settings',
    )
    this.queryClient?.setQueryData(schedulingQueryKeys.settings(), settings)
    return settings
  }

  async getPublicBookingContext(
    token: string,
  ): Promise<PublicBookingContext> {
    const response = await fetch(
      `${this.baseUrl}/schedule/public/${encodeURIComponent(token)}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    return this.parseResponse(response, 'Failed to load booking link')
  }

  async getAvailability(
    token: string,
    startDate: string,
    endDate: string,
  ): Promise<AvailabilityResponse> {
    const url = new URL(`${this.baseUrl}/schedule/availability`)
    url.searchParams.set('token', token)
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)

    const response = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return this.parseResponse(response, 'Failed to load availability')
  }

  async holdSlot(token: string, slot: string): Promise<ScheduleHoldResponse> {
    const response = await fetch(`${this.baseUrl}/schedule/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, slot }),
    })

    return this.parseResponse(response, 'Failed to hold selected slot')
  }

  async confirmBooking(input: {
    token: string
    holdId: string
    slot: string
    contactDetails: { name: string; email: string; phone?: string }
  }): Promise<ScheduleConfirmResponse> {
    const response = await fetch(`${this.baseUrl}/schedule/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    return this.parseResponse(response, 'Failed to confirm booking')
  }

  private async parseResponse<T>(
    response: Response,
    fallbackMessage: string,
  ): Promise<T> {
    if (!response.ok) {
      let message = fallbackMessage
      try {
        const body = await response.json()
        message = body.message || body.error || message
      } catch {
        message = `${fallbackMessage}: ${response.statusText}`
      }
      throw new Error(message)
    }

    return response.json()
  }
}

export let schedulingService = new SchedulingService()

export function createSchedulingService(queryClient: QueryClient) {
  schedulingService = new SchedulingService(queryClient)
  return schedulingService
}

export function getSchedulingService() {
  return schedulingService
}
