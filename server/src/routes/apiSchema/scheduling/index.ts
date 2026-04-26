import { Type } from '@sinclair/typebox';

const WorkingHourRangeSchema = Type.Object({
  start: Type.String({ pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' }),
  end: Type.String({ pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' }),
});

export const WorkingHoursSchema = Type.Object({
  monday: Type.Array(WorkingHourRangeSchema),
  tuesday: Type.Array(WorkingHourRangeSchema),
  wednesday: Type.Array(WorkingHourRangeSchema),
  thursday: Type.Array(WorkingHourRangeSchema),
  friday: Type.Array(WorkingHourRangeSchema),
  saturday: Type.Array(WorkingHourRangeSchema),
  sunday: Type.Array(WorkingHourRangeSchema),
});

export const SchedulingSettingsRequestSchema = Type.Object({
  timezone: Type.Optional(Type.String()),
  workingHours: Type.Optional(WorkingHoursSchema),
  meetingDurationMinutes: Type.Optional(Type.Integer({ minimum: 5, maximum: 240 })),
  bufferBeforeMinutes: Type.Optional(Type.Integer({ minimum: 0, maximum: 240 })),
  bufferAfterMinutes: Type.Optional(Type.Integer({ minimum: 0, maximum: 240 })),
  minNoticeMinutes: Type.Optional(Type.Integer({ minimum: 0, maximum: 43200 })),
  bookingHorizonDays: Type.Optional(Type.Integer({ minimum: 1, maximum: 365 })),
  respectFreeBusy: Type.Optional(Type.Boolean()),
});

export const SchedulingSettingsResponseSchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  userId: Type.String(),
  timezone: Type.String(),
  workingHours: WorkingHoursSchema,
  meetingDurationMinutes: Type.Integer(),
  bufferBeforeMinutes: Type.Integer(),
  bufferAfterMinutes: Type.Integer(),
  minNoticeMinutes: Type.Integer(),
  bookingHorizonDays: Type.Integer(),
  respectFreeBusy: Type.Boolean(),
});

export const BookingTokenParamsSchema = Type.Object({
  token: Type.String(),
});

export const PublicBookingContextResponseSchema = Type.Object({
  tokenId: Type.String(),
  timezone: Type.String(),
  meetingDurationMinutes: Type.Integer(),
  lead: Type.Object({
    id: Type.String(),
    name: Type.String(),
    url: Type.String(),
  }),
  contact: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    company: Type.Optional(Type.String()),
  }),
});

export const AvailabilityQuerySchema = Type.Object({
  token: Type.String(),
  startDate: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  endDate: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
});

export const AvailabilityResponseSchema = Type.Object({
  availableSlots: Type.Array(Type.String()),
  busyBlocks: Type.Array(
    Type.Object({
      start: Type.String(),
      end: Type.String(),
    })
  ),
  timezone: Type.String(),
});

export const ScheduleHoldRequestSchema = Type.Object({
  token: Type.String(),
  slot: Type.String({ format: 'date-time' }),
});

export const ScheduleHoldResponseSchema = Type.Object({
  holdId: Type.String(),
  expiresAt: Type.String(),
});

export const ScheduleConfirmRequestSchema = Type.Object({
  token: Type.String(),
  holdId: Type.String(),
  slot: Type.String({ format: 'date-time' }),
  contactDetails: Type.Object({
    name: Type.String({ minLength: 1 }),
    email: Type.String({ format: 'email' }),
    phone: Type.Optional(Type.String()),
  }),
});

export const ScheduleConfirmResponseSchema = Type.Object({
  meetingId: Type.String(),
  calendarEventLink: Type.Optional(Type.String()),
});
