import { calendarConnectionService } from './calendar/CalendarConnectionService';
import { calendarProviderFactory } from './calendar/CalendarProviderFactory';
import { bookingTokenService } from './BookingTokenService';
import {
  SchedulingSettingsService,
  WorkingHours,
  schedulingSettingsService,
} from './SchedulingSettingsService';
import { ServiceUnavailableError } from '@/exceptions/error';

export interface TimeInterval {
  start: Date;
  end: Date;
}

export interface AvailabilityRequest {
  tenantId: string;
  userId: string;
  startDate: string;
  endDate: string;
  now?: Date;
}

export interface AvailabilityResponse {
  availableSlots: string[];
  busyBlocks: Array<{ start: string; end: string }>;
  timezone: string;
}

const DAY_KEYS: Array<keyof WorkingHours> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export class AvailabilityService {
  constructor(private readonly settingsService: SchedulingSettingsService) {}

  async getAvailabilityForToken(
    rawToken: string,
    startDate: string,
    endDate: string,
    now = new Date()
  ): Promise<AvailabilityResponse> {
    const context = await bookingTokenService.resolve(rawToken);
    return await this.getAvailability({
      tenantId: context.token.tenantId,
      userId: context.token.userId,
      startDate,
      endDate,
      now,
    });
  }

  async getAvailability(request: AvailabilityRequest): Promise<AvailabilityResponse> {
    const settings = await this.settingsService.getForUser(request.tenantId, request.userId);
    const connection = await calendarConnectionService.getActiveConnection(
      request.tenantId,
      request.userId
    );
    if (!connection) {
      throw new ServiceUnavailableError('No scheduling calendar connected');
    }

    const rangeStart = this.zonedTimeToUtc(request.startDate, '00:00', settings.timezone);
    const rangeEnd = this.zonedTimeToUtc(request.endDate, '23:59', settings.timezone);
    const events = await calendarProviderFactory.create(connection).listEvents({
      calendarId: connection.providerCalendarId,
      timeMin: rangeStart,
      timeMax: rangeEnd,
    });

    const blockers = this.mergeIntervals(
      events
        .filter((event) => (settings.respectFreeBusy ? event.isBusy : true))
        .map((event) => ({
          start: this.addMinutes(event.start, -settings.bufferBeforeMinutes),
          end: this.addMinutes(event.end, settings.bufferAfterMinutes),
        }))
    );

    const now = request.now ?? new Date();
    const noticeStart = new Date(now.getTime() + settings.minNoticeMinutes * 60 * 1000);
    const horizonEnd = new Date(now.getTime() + settings.bookingHorizonDays * 24 * 60 * 60 * 1000);
    const workingIntervals = this.workingIntervals(
      request.startDate,
      request.endDate,
      settings.timezone,
      settings.workingHours as WorkingHours
    ).map((interval) => ({
      start: new Date(
        Math.max(interval.start.getTime(), noticeStart.getTime(), rangeStart.getTime())
      ),
      end: new Date(Math.min(interval.end.getTime(), horizonEnd.getTime(), rangeEnd.getTime())),
    }));

    const availableIntervals = workingIntervals.flatMap((interval) =>
      this.subtractIntervals(interval, blockers)
    );
    const busyBlocks = this.busyBlocksFromWorkingIntervals(workingIntervals, blockers);

    const slots = this.slotsFromIntervals(availableIntervals, settings.meetingDurationMinutes);

    return {
      availableSlots: slots.map((slot) => slot.toISOString()),
      busyBlocks: busyBlocks.map((block) => ({
        start: block.start.toISOString(),
        end: block.end.toISOString(),
      })),
      timezone: settings.timezone,
    };
  }

  isSlotAvailable(slotStart: Date, availableSlots: string[]): boolean {
    return availableSlots.some((slot) => new Date(slot).getTime() === slotStart.getTime());
  }

  workingIntervals(
    startDate: string,
    endDate: string,
    timezone: string,
    workingHours: WorkingHours
  ): TimeInterval[] {
    const dates = this.dateStringsBetween(startDate, endDate);
    return dates.flatMap((dateString) => {
      const dayKey = DAY_KEYS[this.localDayIndex(dateString, timezone)];
      if (!dayKey) return [];

      return (workingHours[dayKey] ?? []).map((range) => ({
        start: this.zonedTimeToUtc(dateString, range.start, timezone),
        end: this.zonedTimeToUtc(dateString, range.end, timezone),
      }));
    });
  }

  mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
    const sorted = intervals
      .filter((interval) => interval.start < interval.end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged: TimeInterval[] = [];

    for (const interval of sorted) {
      const last = merged.at(-1);
      if (!last || interval.start > last.end) {
        merged.push({ ...interval });
      } else if (interval.end > last.end) {
        last.end = interval.end;
      }
    }

    return merged;
  }

  subtractIntervals(interval: TimeInterval, blockers: TimeInterval[]): TimeInterval[] {
    let remaining = [interval];

    for (const blocker of blockers) {
      remaining = remaining.flatMap((candidate) => {
        if (blocker.end <= candidate.start || blocker.start >= candidate.end) {
          return [candidate];
        }

        const pieces: TimeInterval[] = [];
        if (blocker.start > candidate.start) {
          pieces.push({ start: candidate.start, end: blocker.start });
        }
        if (blocker.end < candidate.end) {
          pieces.push({ start: blocker.end, end: candidate.end });
        }
        return pieces;
      });
    }

    return remaining;
  }

  slotsFromIntervals(intervals: TimeInterval[], durationMinutes: number): Date[] {
    const durationMs = durationMinutes * 60 * 1000;
    const slots: Date[] = [];

    for (const interval of intervals) {
      for (
        let cursor = interval.start.getTime();
        cursor + durationMs <= interval.end.getTime();
        cursor += durationMs
      ) {
        slots.push(new Date(cursor));
      }
    }

    return slots;
  }

  busyBlocksFromWorkingIntervals(workingIntervals: TimeInterval[], blockers: TimeInterval[]): TimeInterval[] {
    const busyBlocks = workingIntervals.flatMap((workingInterval) =>
      blockers.flatMap((blocker) => {
        const start = new Date(Math.max(workingInterval.start.getTime(), blocker.start.getTime()));
        const end = new Date(Math.min(workingInterval.end.getTime(), blocker.end.getTime()));

        return start < end ? [{ start, end }] : [];
      })
    );

    return this.mergeIntervals(busyBlocks);
  }

  addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private dateStringsBetween(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
  }

  private localDayIndex(dateString: string, timezone: string): number {
    const date = this.zonedTimeToUtc(dateString, '12:00', timezone);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts);
  }

  private zonedTimeToUtc(dateString: string, time: string, timezone: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    if (
      year === undefined ||
      month === undefined ||
      day === undefined ||
      hour === undefined ||
      minute === undefined
    ) {
      throw new Error('Invalid date or time');
    }

    const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const offset = this.getTimeZoneOffset(localAsUtc, timezone);
    const firstPass = new Date(localAsUtc.getTime() - offset);
    const correctedOffset = this.getTimeZoneOffset(firstPass, timezone);
    return new Date(localAsUtc.getTime() - correctedOffset);
  }

  private getTimeZoneOffset(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    return asUtc - date.getTime();
  }
}

export const availabilityService = new AvailabilityService(schedulingSettingsService);
