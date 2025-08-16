import { logger } from '@/libs/logger';

/**
 * Utility functions for campaign schedule calculations
 */

/**
 * Parses ISO 8601 duration string into milliseconds
 * Supports: PT0S, PT24H, PT30M, P3D, P1DT12H30M, etc.
 */
export function parseIsoDuration(duration: string): number {
  if (duration === 'PT0S' || duration === 'PT0M' || duration === 'PT0H') return 0;

  // More comprehensive regex for ISO 8601 duration
  const matches = duration.match(
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  );

  if (!matches) {
    throw new Error(`Invalid ISO 8601 duration: ${duration}`);
  }

  const [, years, months, weeks, days, hours, minutes, seconds] = matches;
  let milliseconds = 0;

  // Convert to milliseconds (approximations for years/months)
  if (years) milliseconds += parseFloat(years) * 365.25 * 24 * 60 * 60 * 1000;
  if (months) milliseconds += parseFloat(months) * 30.44 * 24 * 60 * 60 * 1000; // Average month
  if (weeks) milliseconds += parseFloat(weeks) * 7 * 24 * 60 * 60 * 1000;
  if (days) milliseconds += parseFloat(days) * 24 * 60 * 60 * 1000;
  if (hours) milliseconds += parseFloat(hours) * 60 * 60 * 1000;
  if (minutes) milliseconds += parseFloat(minutes) * 60 * 1000;
  if (seconds) milliseconds += parseFloat(seconds) * 1000;

  return milliseconds;
}

/**
 * Calculates the next valid send time considering timezone and quiet hours
 */
export function calculateScheduleTime(
  delay: string,
  timezone: string,
  quietHours?: { start: string; end: string },
  baseTime?: Date
): Date {
  try {
    const base = baseTime || new Date();
    const delayMs = parseIsoDuration(delay);
    let scheduledAt = new Date(base.getTime() + delayMs);

    // Apply quiet hours if specified
    if (quietHours) {
      scheduledAt = applyQuietHours(scheduledAt, timezone, quietHours);
    }

    return scheduledAt;
  } catch (error) {
    logger.warn('Failed to parse schedule delay, using immediate execution', {
      delay,
      timezone,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return baseTime || new Date();
  }
}

/**
 * Gets the hour and minute in a specific timezone for a given UTC date
 */
function getTimeInTimezone(utcDate: Date, timezone: string): { hour: number; minute: number } {
  try {
    // Use Intl.DateTimeFormat to get the time components in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcDate);
    const hour = parseInt(parts.find((part) => part.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((part) => part.type === 'minute')?.value || '0', 10);

    return { hour, minute };
  } catch (error) {
    logger.warn('Failed to get time in timezone, using UTC', {
      timezone,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fallback to UTC
    return { hour: utcDate.getUTCHours(), minute: utcDate.getUTCMinutes() };
  }
}

/**
 * Creates a new Date in UTC that represents the same wall-clock time in the target timezone
 */
function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  try {
    // Create a temporary date in UTC
    const tempDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

    // Get what this UTC time would be in the target timezone
    const { hour: targetHour, minute: targetMinute } = getTimeInTimezone(tempDate, timezone);

    // Calculate the difference between what we want and what we got
    const wantedMinutes = hour * 60 + minute;
    const actualMinutes = targetHour * 60 + targetMinute;
    const offsetMinutes = wantedMinutes - actualMinutes;

    // Adjust the UTC time by the offset
    return new Date(tempDate.getTime() + offsetMinutes * 60 * 1000);
  } catch (error) {
    logger.warn('Failed to create date in timezone, using UTC', {
      timezone,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Fallback to UTC
    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  }
}

/**
 * Adjusts a scheduled time to respect quiet hours in the given timezone
 */
export function applyQuietHours(
  scheduledAt: Date,
  timezone: string,
  quietHours: { start: string; end: string }
): Date {
  try {
    // Special handling for UTC to avoid cross-platform timezone calculation differences
    if (timezone === 'UTC') {
      return applyQuietHoursUTC(scheduledAt, quietHours);
    }

    // Get the time components in the target timezone
    const { hour, minute } = getTimeInTimezone(scheduledAt, timezone);
    const currentTime = hour * 60 + minute; // Minutes since midnight

    // Parse quiet hours (HH:MM format)
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const quietStart = startHour ? startHour * 60 + (startMin || 0) : 0;
    const quietStart = startHour !== undefined ? startHour * 60 + (startMin || 0) : 0;
    const quietEnd = endHour !== undefined ? endHour * 60 + (endMin || 0) : 0;

    // Determine if current time is in quiet hours
    let isQuietTime = false;
    if (quietEnd > quietStart) {
      // Quiet hours don't span midnight (e.g., 09:00 to 17:00)
      isQuietTime = currentTime >= quietStart && currentTime <= quietEnd;
    } else {
      // Quiet hours span midnight (e.g., 22:00 to 07:00)
      isQuietTime = currentTime >= quietStart || currentTime <= quietEnd;
    }

    if (!isQuietTime) {
      return scheduledAt; // Not in quiet hours, keep original time
    }

    // Move to end of quiet hours
    // Get the date components in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const parts = formatter.formatToParts(scheduledAt);
    const year = parseInt(parts.find((part) => part.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find((part) => part.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find((part) => part.type === 'day')?.value || '0', 10);

    let adjustedYear = year;
    let adjustedMonth = month;
    let adjustedDay = day;

    // If quiet hours span midnight and we're before midnight, the end time is tomorrow
    if (quietEnd < quietStart && currentTime >= quietStart) {
      const nextDay = new Date(year, month - 1, day + 1);
      adjustedYear = nextDay.getFullYear();
      adjustedMonth = nextDay.getMonth() + 1;
      adjustedDay = nextDay.getDate();
    }

    // Create the adjusted date in the target timezone
    const adjustedDate = createDateInTimezone(
      adjustedYear,
      adjustedMonth,
      adjustedDay,
      endHour || 0,
      endMin || 0,
      timezone
    );

    return adjustedDate;
  } catch (error) {
    logger.warn('Failed to apply quiet hours, using original time', {
      timezone,
      quietHours,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return scheduledAt;
  }
}

/**
 * UTC-specific implementation of quiet hours to avoid cross-platform timezone differences
 */
function applyQuietHoursUTC(scheduledAt: Date, quietHours: { start: string; end: string }): Date {
  // Get UTC time components directly
  const hour = scheduledAt.getUTCHours();
  const minute = scheduledAt.getUTCMinutes();
  const currentTime = hour * 60 + minute; // Minutes since midnight

  // Parse quiet hours (HH:MM format)
  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);
  const quietStart = startHour ? startHour * 60 + (startMin || 0) : 0;
  const quietStart = startHour !== undefined ? startHour * 60 + (startMin || 0) : 0;
  const quietEnd = endHour !== undefined ? endHour * 60 + (endMin || 0) : 0;

  // Determine if current time is in quiet hours
  let isQuietTime = false;
  if (quietEnd > quietStart) {
    // Quiet hours don't span midnight (e.g., 09:00 to 17:00)
    isQuietTime = currentTime >= quietStart && currentTime <= quietEnd;
  } else {
    // Quiet hours span midnight (e.g., 22:00 to 07:00)
    isQuietTime = currentTime >= quietStart || currentTime <= quietEnd;
  }

  if (!isQuietTime) {
    return scheduledAt; // Not in quiet hours, keep original time
  }

  // Move to end of quiet hours using pure UTC calculations
  let adjustedDate = new Date(scheduledAt);

  // If quiet hours span midnight and we're before midnight, the end time is tomorrow
  if (quietEnd < quietStart && currentTime >= quietStart) {
    // We're in the late night portion (e.g., 22:30), move to next day's end time
    adjustedDate.setUTCDate(adjustedDate.getUTCDate() + 1);
  }

  // Set to the end time of quiet hours
  adjustedDate.setUTCHours(endHour || 0, endMin || 0, 0, 0);

  return adjustedDate;
}

/**
 * Checks if a given time falls within quiet hours for a timezone
 */
export function isInQuietHours(
  time: Date,
  timezone: string,
  quietHours: { start: string; end: string }
): boolean {
  try {
    // Special handling for UTC to avoid cross-platform timezone calculation differences
    if (timezone === 'UTC') {
      return isInQuietHoursUTC(time, quietHours);
    }

    // Get the time components in the target timezone
    const { hour, minute } = getTimeInTimezone(time, timezone);
    const currentTime = hour * 60 + minute;

    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const quietStart = startHour ? startHour * 60 + (startMin || 0) : 0;
    const quietStart = !isNaN(startHour) ? startHour * 60 + (startMin || 0) : 0;
    const quietEnd = !isNaN(endHour) ? endHour * 60 + (endMin || 0) : 0;

    if (quietEnd > quietStart) {
      return currentTime >= quietStart && currentTime <= quietEnd;
    } else {
      return currentTime >= quietStart || currentTime <= quietEnd;
    }
  } catch (error) {
    logger.warn('Failed to check quiet hours', {
      timezone,
      quietHours,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * UTC-specific implementation of quiet hours check
 */
function isInQuietHoursUTC(time: Date, quietHours: { start: string; end: string }): boolean {
  // Get UTC time components directly
  const hour = time.getUTCHours();
  const minute = time.getUTCMinutes();
  const currentTime = hour * 60 + minute;

  const [startHour, startMin] = quietHours.start.split(':').map(Number);
  const [endHour, endMin] = quietHours.end.split(':').map(Number);
  const quietStart = startHour ? startHour * 60 + (startMin || 0) : 0;
  const quietStart = startHour !== undefined ? startHour * 60 + (startMin || 0) : 0;
  const quietEnd = endHour !== undefined ? endHour * 60 + (endMin || 0) : 0;

  if (quietEnd > quietStart) {
    return currentTime >= quietStart && currentTime <= quietEnd;
  } else {
    return currentTime >= quietStart || currentTime <= quietEnd;
  }
}

/**
 * Validates ISO 8601 duration format
 */
export function isValidIsoDuration(duration: string): boolean {
  try {
    parseIsoDuration(duration);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates HH:MM time format
 */
export function isValidTimeFormat(time: string): boolean {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(time);
}

/**
 * Validates timezone using Intl.DateTimeFormat
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
