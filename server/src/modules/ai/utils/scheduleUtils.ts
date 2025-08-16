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
 * Adjusts a scheduled time to respect quiet hours in the given timezone
 */
export function applyQuietHours(
  scheduledAt: Date,
  timezone: string,
  quietHours: { start: string; end: string }
): Date {
  try {
    // Convert to timezone-aware date
    const zonedDate = new Date(scheduledAt.toLocaleString('en-US', { timeZone: timezone }));

    const hour = zonedDate.getHours();
    const minute = zonedDate.getMinutes();
    const currentTime = hour * 60 + minute; // Minutes since midnight

    // Parse quiet hours (HH:MM format)
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const quietStart = startHour * 60 + startMin;
    const quietEnd = endHour * 60 + endMin;

    // Determine if current time is in quiet hours
    let isQuietTime = false;
    if (quietEnd > quietStart) {
      // Quiet hours don't span midnight (e.g., 22:00 to 06:00 next day)
      isQuietTime = currentTime >= quietStart && currentTime <= quietEnd;
    } else {
      // Quiet hours span midnight (e.g., 22:00 to 06:00)
      isQuietTime = currentTime >= quietStart || currentTime <= quietEnd;
    }

    if (!isQuietTime) {
      return scheduledAt; // Not in quiet hours, keep original time
    }

    // Move to end of quiet hours
    const adjustedDate = new Date(zonedDate);
    adjustedDate.setHours(endHour, endMin, 0, 0);

    // If quiet hours span midnight and we're before midnight,
    // the end time is tomorrow
    if (quietEnd < quietStart && currentTime >= quietStart) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }

    // Convert back from timezone to UTC
    const timezoneOffset = getTimezoneOffset(timezone, adjustedDate);
    const utcTime = new Date(adjustedDate.getTime() + timezoneOffset);

    return utcTime;
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
 * Gets timezone offset in milliseconds for a given date and timezone
 */
function getTimezoneOffset(timezone: string, date: Date): number {
  try {
    // Create date in timezone and UTC
    const zonedTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));

    return utcTime.getTime() - zonedTime.getTime();
  } catch (error) {
    logger.warn('Failed to calculate timezone offset', {
      timezone,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
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
    const zonedDate = new Date(time.toLocaleString('en-US', { timeZone: timezone }));
    const hour = zonedDate.getHours();
    const minute = zonedDate.getMinutes();
    const currentTime = hour * 60 + minute;

    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);
    const quietStart = startHour * 60 + startMin;
    const quietEnd = endHour * 60 + endMin;

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
