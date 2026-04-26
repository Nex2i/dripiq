import { userScheduleSettingsRepository } from '@/repositories';
import { BadRequestError } from '@/exceptions/error';
import { UserScheduleSetting } from '@/db/schema';

export interface WorkingHourRange {
  start: string;
  end: string;
}

export type WorkingHours = Record<string, WorkingHourRange[]>;

export interface SchedulingSettingsInput {
  timezone?: string;
  workingHours?: WorkingHours;
  meetingDurationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minNoticeMinutes?: number;
  bookingHorizonDays?: number;
  respectFreeBusy?: boolean;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: [],
};

const DAYS = Object.keys(DEFAULT_WORKING_HOURS);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class SchedulingSettingsService {
  async getForUser(tenantId: string, userId: string): Promise<UserScheduleSetting> {
    const existing = await userScheduleSettingsRepository.findByUserForTenant(tenantId, userId);
    if (existing) return existing;

    return await this.upsertForUser(tenantId, userId, {});
  }

  async upsertForUser(
    tenantId: string,
    userId: string,
    input: SchedulingSettingsInput
  ): Promise<UserScheduleSetting> {
    const normalized = this.normalize(input);

    return await userScheduleSettingsRepository.upsertForUser(tenantId, userId, {
      timezone: normalized.timezone,
      workingHours: normalized.workingHours,
      meetingDurationMinutes: normalized.meetingDurationMinutes,
      bufferBeforeMinutes: normalized.bufferBeforeMinutes,
      bufferAfterMinutes: normalized.bufferAfterMinutes,
      minNoticeMinutes: normalized.minNoticeMinutes,
      bookingHorizonDays: normalized.bookingHorizonDays,
      respectFreeBusy: normalized.respectFreeBusy,
    });
  }

  normalize(input: SchedulingSettingsInput): Required<SchedulingSettingsInput> {
    const timezone = input.timezone?.trim() || 'America/Chicago';
    this.validateTimezone(timezone);

    const workingHours = this.normalizeWorkingHours(input.workingHours ?? DEFAULT_WORKING_HOURS);

    return {
      timezone,
      workingHours,
      meetingDurationMinutes: this.validatePositiveInteger(
        input.meetingDurationMinutes ?? 30,
        'meetingDurationMinutes',
        5,
        240
      ),
      bufferBeforeMinutes: this.validateNonNegativeInteger(
        input.bufferBeforeMinutes ?? 0,
        'bufferBeforeMinutes',
        0,
        240
      ),
      bufferAfterMinutes: this.validateNonNegativeInteger(
        input.bufferAfterMinutes ?? 0,
        'bufferAfterMinutes',
        0,
        240
      ),
      minNoticeMinutes: this.validateNonNegativeInteger(
        input.minNoticeMinutes ?? 120,
        'minNoticeMinutes',
        0,
        30 * 24 * 60
      ),
      bookingHorizonDays: this.validatePositiveInteger(
        input.bookingHorizonDays ?? 14,
        'bookingHorizonDays',
        1,
        365
      ),
      respectFreeBusy: input.respectFreeBusy ?? true,
    };
  }

  private normalizeWorkingHours(workingHours: WorkingHours): WorkingHours {
    const normalized: WorkingHours = {};

    for (const day of DAYS) {
      const ranges = workingHours[day] ?? [];
      if (!Array.isArray(ranges)) {
        throw new BadRequestError(`Working hours for ${day} must be an array`);
      }

      normalized[day] = ranges.map((range) => this.validateRange(day, range));
    }

    return normalized;
  }

  private validateRange(day: string, range: WorkingHourRange): WorkingHourRange {
    if (!range || !TIME_PATTERN.test(range.start) || !TIME_PATTERN.test(range.end)) {
      throw new BadRequestError(`Invalid working hours range for ${day}`);
    }

    if (this.minutes(range.start) >= this.minutes(range.end)) {
      throw new BadRequestError(`Working hours start must be before end for ${day}`);
    }

    return { start: range.start, end: range.end };
  }

  private validateTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch {
      throw new BadRequestError('Invalid timezone');
    }
  }

  private validatePositiveInteger(
    value: number,
    field: string,
    min: number,
    max: number
  ): number {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestError(`${field} must be an integer between ${min} and ${max}`);
    }
    return value;
  }

  private validateNonNegativeInteger(
    value: number,
    field: string,
    min: number,
    max: number
  ): number {
    return this.validatePositiveInteger(value, field, min, max);
  }

  private minutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    if (hours === undefined || minutes === undefined) {
      throw new BadRequestError('Invalid time value');
    }

    return hours * 60 + minutes;
  }
}

export const schedulingSettingsService = new SchedulingSettingsService();
