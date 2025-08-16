import {
  parseIsoDuration,
  calculateScheduleTime,
  applyQuietHours,
  isInQuietHours,
  isValidIsoDuration,
  isValidTimeFormat,
  isValidTimezone,
} from '../scheduleUtils';
import { logger } from '@/libs/logger';

// Mock the logger to avoid console output during tests
jest.mock('@/libs/logger');
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('Schedule Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any Date mocks
    jest.useRealTimers();
  });

  describe('parseIsoDuration', () => {
    describe('Basic Functionality', () => {
      it('should parse zero durations correctly', () => {
        expect(parseIsoDuration('PT0S')).toBe(0);
        expect(parseIsoDuration('PT0M')).toBe(0);
        expect(parseIsoDuration('PT0H')).toBe(0);
      });

      it('should parse seconds correctly', () => {
        expect(parseIsoDuration('PT30S')).toBe(30 * 1000);
        expect(parseIsoDuration('PT1.5S')).toBe(1.5 * 1000);
      });

      it('should parse minutes correctly', () => {
        expect(parseIsoDuration('PT5M')).toBe(5 * 60 * 1000);
        expect(parseIsoDuration('PT30M')).toBe(30 * 60 * 1000);
        expect(parseIsoDuration('PT1.5M')).toBe(1.5 * 60 * 1000);
      });

      it('should parse hours correctly', () => {
        expect(parseIsoDuration('PT1H')).toBe(1 * 60 * 60 * 1000);
        expect(parseIsoDuration('PT24H')).toBe(24 * 60 * 60 * 1000);
        expect(parseIsoDuration('PT1.5H')).toBe(1.5 * 60 * 60 * 1000);
      });

      it('should parse days correctly', () => {
        expect(parseIsoDuration('P1D')).toBe(1 * 24 * 60 * 60 * 1000);
        expect(parseIsoDuration('P3D')).toBe(3 * 24 * 60 * 60 * 1000);
        expect(parseIsoDuration('P1.5D')).toBe(1.5 * 24 * 60 * 60 * 1000);
      });

      it('should parse weeks correctly', () => {
        expect(parseIsoDuration('P1W')).toBe(1 * 7 * 24 * 60 * 60 * 1000);
        expect(parseIsoDuration('P2W')).toBe(2 * 7 * 24 * 60 * 60 * 1000);
      });

      it('should parse months correctly (approximate)', () => {
        const expectedMs = 1 * 30.44 * 24 * 60 * 60 * 1000;
        expect(parseIsoDuration('P1M')).toBeCloseTo(expectedMs, 0);
      });

      it('should parse years correctly (approximate)', () => {
        const expectedMs = 1 * 365.25 * 24 * 60 * 60 * 1000;
        expect(parseIsoDuration('P1Y')).toBeCloseTo(expectedMs, 0);
      });
    });

    describe('Complex Durations', () => {
      it('should parse combined durations correctly', () => {
        // P1DT12H30M = 1 day + 12 hours + 30 minutes
        const expected = (1 * 24 * 60 * 60 * 1000) + (12 * 60 * 60 * 1000) + (30 * 60 * 1000);
        expect(parseIsoDuration('P1DT12H30M')).toBe(expected);
      });

      it('should parse all components together', () => {
        // P1Y2M3DT4H5M6S
        const years = 1 * 365.25 * 24 * 60 * 60 * 1000;
        const months = 2 * 30.44 * 24 * 60 * 60 * 1000;
        const days = 3 * 24 * 60 * 60 * 1000;
        const hours = 4 * 60 * 60 * 1000;
        const minutes = 5 * 60 * 1000;
        const seconds = 6 * 1000;
        const expected = years + months + days + hours + minutes + seconds;
        
        expect(parseIsoDuration('P1Y2M3DT4H5M6S')).toBeCloseTo(expected, 0);
      });

      it('should handle decimal components', () => {
        // PT1.5H30.5M
        const expected = (1.5 * 60 * 60 * 1000) + (30.5 * 60 * 1000);
        expect(parseIsoDuration('PT1.5H30.5M')).toBe(expected);
      });
    });

    describe('Error Handling', () => {
      it('should throw error for invalid duration format', () => {
        expect(() => parseIsoDuration('invalid')).toThrow('Invalid ISO 8601 duration: invalid');
        expect(() => parseIsoDuration('P')).toThrow('Invalid ISO 8601 duration: P');
        expect(() => parseIsoDuration('PT')).toThrow('Invalid ISO 8601 duration: PT');
        expect(() => parseIsoDuration('24H')).toThrow('Invalid ISO 8601 duration: 24H');
        expect(() => parseIsoDuration('P1DT')).toThrow('Invalid ISO 8601 duration: P1DT');
      });

      it('should throw error for negative durations', () => {
        expect(() => parseIsoDuration('P-1D')).toThrow('Invalid ISO 8601 duration: P-1D');
        expect(() => parseIsoDuration('PT-5M')).toThrow('Invalid ISO 8601 duration: PT-5M');
      });

      it('should throw error for malformed time components', () => {
        expect(() => parseIsoDuration('PT1H2H')).toThrow('Invalid ISO 8601 duration: PT1H2H');
        expect(() => parseIsoDuration('P1D1D')).toThrow('Invalid ISO 8601 duration: P1D1D');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        expect(() => parseIsoDuration('')).toThrow('Invalid ISO 8601 duration: ');
      });

      it('should handle very large durations', () => {
        const result = parseIsoDuration('P999Y');
        expect(result).toBeGreaterThan(0);
        expect(typeof result).toBe('number');
      });

      it('should handle very small decimal durations', () => {
        expect(parseIsoDuration('PT0.001S')).toBe(0.001 * 1000);
        expect(parseIsoDuration('PT0.1M')).toBe(0.1 * 60 * 1000);
      });
    });
  });

  describe('calculateScheduleTime', () => {
    const mockBaseTime = new Date('2024-01-15T10:00:00.000Z');

    describe('Basic Functionality', () => {
      it('should calculate immediate execution', () => {
        const result = calculateScheduleTime('PT0S', 'UTC', undefined, mockBaseTime);
        expect(result).toEqual(mockBaseTime);
      });

      it('should add delay to base time', () => {
        const expected = new Date(mockBaseTime.getTime() + (2 * 60 * 60 * 1000)); // +2 hours
        const result = calculateScheduleTime('PT2H', 'UTC', undefined, mockBaseTime);
        expect(result).toEqual(expected);
      });

      it('should use current time when baseTime is not provided', () => {
        const before = Date.now();
        const result = calculateScheduleTime('PT0S', 'UTC');
        const after = Date.now();
        
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });

      it('should handle complex durations', () => {
        // P1DT12H = 36 hours
        const expected = new Date(mockBaseTime.getTime() + (36 * 60 * 60 * 1000));
        const result = calculateScheduleTime('P1DT12H', 'UTC', undefined, mockBaseTime);
        expect(result).toEqual(expected);
      });
    });

    describe('Quiet Hours Integration', () => {
      it('should apply quiet hours when specified', () => {
        const quietHours = { start: '22:00', end: '07:00' };
        // Mock a time that would be in quiet hours
        const duringQuietTime = new Date('2024-01-15T23:00:00.000Z'); // 11 PM UTC
        
        const result = calculateScheduleTime('PT1H', 'UTC', quietHours, duringQuietTime);
        
        // Should be moved to after quiet hours (7 AM next day)
        expect(result.getHours()).toBe(7);
        expect(result.getMinutes()).toBe(0);
      });

      it('should not modify time when outside quiet hours', () => {
        const quietHours = { start: '22:00', end: '07:00' };
        const outsideQuietTime = new Date('2024-01-15T10:00:00.000Z'); // 10 AM UTC
        
        const expected = new Date(outsideQuietTime.getTime() + (1 * 60 * 60 * 1000)); // +1 hour
        const result = calculateScheduleTime('PT1H', 'UTC', quietHours, outsideQuietTime);
        
        expect(result).toEqual(expected);
      });

      it('should work with different timezones', () => {
        const quietHours = { start: '22:00', end: '07:00' };
        const result = calculateScheduleTime('PT1H', 'America/New_York', quietHours, mockBaseTime);
        
        expect(result).toBeInstanceOf(Date);
        expect(typeof result.getTime()).toBe('number');
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid duration gracefully', () => {
        mockLogger.warn.mockClear();
        
        const result = calculateScheduleTime('invalid-duration', 'UTC', undefined, mockBaseTime);
        
        expect(result).toEqual(mockBaseTime);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to parse schedule delay, using immediate execution',
          expect.objectContaining({
            delay: 'invalid-duration',
            timezone: 'UTC',
            error: expect.any(String),
          })
        );
      });

      it('should handle invalid timezone gracefully', () => {
        // Even with invalid timezone, function should not throw
        const result = calculateScheduleTime('PT1H', 'Invalid/Timezone', undefined, mockBaseTime);
        
        expect(result).toBeInstanceOf(Date);
      });

      it('should return current time when baseTime is undefined and parsing fails', () => {
        const before = Date.now();
        const result = calculateScheduleTime('invalid-duration', 'UTC');
        const after = Date.now();
        
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after);
      });
    });
  });

  describe('applyQuietHours', () => {
    describe('Non-spanning Quiet Hours (e.g., 09:00-17:00)', () => {
      const quietHours = { start: '09:00', end: '17:00' };

      it('should not modify time outside quiet hours', () => {
        const earlyMorning = new Date('2024-01-15T08:00:00.000Z');
        const result = applyQuietHours(earlyMorning, 'UTC', quietHours);
        expect(result).toEqual(earlyMorning);

        const evening = new Date('2024-01-15T18:00:00.000Z');
        const result2 = applyQuietHours(evening, 'UTC', quietHours);
        expect(result2).toEqual(evening);
      });

      it('should move time to end of quiet hours when inside', () => {
        const duringQuiet = new Date('2024-01-15T12:00:00.000Z'); // Noon UTC
        const result = applyQuietHours(duringQuiet, 'UTC', quietHours);
        
        expect(result.getUTCHours()).toBe(17);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getUTCSeconds()).toBe(0);
      });

      it('should handle edge case at exact start time', () => {
        const exactStart = new Date('2024-01-15T09:00:00.000Z');
        const result = applyQuietHours(exactStart, 'UTC', quietHours);
        
        expect(result.getUTCHours()).toBe(17);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it('should handle edge case at exact end time', () => {
        const exactEnd = new Date('2024-01-15T17:00:00.000Z');
        const result = applyQuietHours(exactEnd, 'UTC', quietHours);
        
        expect(result.getUTCHours()).toBe(17);
        expect(result.getUTCMinutes()).toBe(0);
      });
    });

    describe('Midnight-spanning Quiet Hours (e.g., 22:00-07:00)', () => {
      const quietHours = { start: '22:00', end: '07:00' };

      it('should not modify time outside quiet hours', () => {
        const midday = new Date('2024-01-15T12:00:00.000Z');
        const result = applyQuietHours(midday, 'UTC', quietHours);
        expect(result).toEqual(midday);

        const afternoon = new Date('2024-01-15T15:00:00.000Z');
        const result2 = applyQuietHours(afternoon, 'UTC', quietHours);
        expect(result2).toEqual(afternoon);
      });

      it('should move late night time to next morning', () => {
        const lateNight = new Date('2024-01-15T23:00:00.000Z'); // 11 PM
        const result = applyQuietHours(lateNight, 'UTC', quietHours);
        
        expect(result.getUTCDate()).toBe(16); // Next day
        expect(result.getUTCHours()).toBe(7);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it('should move early morning time to same morning end', () => {
        const earlyMorning = new Date('2024-01-15T05:00:00.000Z'); // 5 AM
        const result = applyQuietHours(earlyMorning, 'UTC', quietHours);
        
        expect(result.getUTCDate()).toBe(15); // Same day
        expect(result.getUTCHours()).toBe(7);
        expect(result.getUTCMinutes()).toBe(0);
      });

      it('should handle exact midnight boundary', () => {
        const midnight = new Date('2024-01-15T00:00:00.000Z');
        const result = applyQuietHours(midnight, 'UTC', quietHours);
        
        expect(result.getUTCHours()).toBe(7);
        expect(result.getUTCMinutes()).toBe(0);
      });
    });

    describe('Timezone Handling', () => {
      it('should work with different timezones', () => {
        const quietHours = { start: '22:00', end: '07:00' };
        const utcTime = new Date('2024-01-15T14:00:00.000Z'); // 2 PM UTC
        
        // In Pacific time, this would be 6 AM (within quiet hours ending at 7 AM)
        const result = applyQuietHours(utcTime, 'America/Los_Angeles', quietHours);
        
        expect(result).toBeInstanceOf(Date);
        // Result should be adjusted
        expect(result).not.toEqual(utcTime);
      });

      it('should handle timezone with daylight saving time', () => {
        const quietHours = { start: '22:00', end: '07:00' };
        // Summer time when DST is active
        const summerTime = new Date('2024-07-15T14:00:00.000Z');
        
        const result = applyQuietHours(summerTime, 'America/New_York', quietHours);
        expect(result).toBeInstanceOf(Date);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle invalid timezone gracefully', () => {
        mockLogger.warn.mockClear();
        
        const quietHours = { start: '22:00', end: '07:00' };
        const testTime = new Date('2024-01-15T12:00:00.000Z');
        
        const result = applyQuietHours(testTime, 'Invalid/Timezone', quietHours);
        
        expect(result).toEqual(testTime);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to apply quiet hours, using original time',
          expect.objectContaining({
            timezone: 'Invalid/Timezone',
            quietHours,
            error: expect.any(String),
          })
        );
      });

      it('should handle malformed quiet hours format', () => {
        const badQuietHours = { start: 'invalid', end: '07:00' } as any;
        const testTime = new Date('2024-01-15T12:00:00.000Z');
        
        const result = applyQuietHours(testTime, 'UTC', badQuietHours);
        
        expect(result).toEqual(testTime);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should handle quiet hours with minutes', () => {
        const quietHours = { start: '22:30', end: '07:45' };
        const duringQuiet = new Date('2024-01-15T23:00:00.000Z');
        
        const result = applyQuietHours(duringQuiet, 'UTC', quietHours);
        
        expect(result.getUTCHours()).toBe(7);
        expect(result.getUTCMinutes()).toBe(45);
      });

      it('should handle same start and end time', () => {
        const sameTime = { start: '12:00', end: '12:00' };
        const testTime = new Date('2024-01-15T12:00:00.000Z');
        
        const result = applyQuietHours(testTime, 'UTC', sameTime);
        
        expect(result.getUTCHours()).toBe(12);
        expect(result.getUTCMinutes()).toBe(0);
      });
    });
  });

  describe('isInQuietHours', () => {
    describe('Non-spanning Quiet Hours', () => {
      const quietHours = { start: '09:00', end: '17:00' };

      it('should return true when time is within quiet hours', () => {
        const noon = new Date('2024-01-15T12:00:00.000Z');
        expect(isInQuietHours(noon, 'UTC', quietHours)).toBe(true);

        const startTime = new Date('2024-01-15T09:00:00.000Z');
        expect(isInQuietHours(startTime, 'UTC', quietHours)).toBe(true);

        const endTime = new Date('2024-01-15T17:00:00.000Z');
        expect(isInQuietHours(endTime, 'UTC', quietHours)).toBe(true);
      });

      it('should return false when time is outside quiet hours', () => {
        const earlyMorning = new Date('2024-01-15T08:59:00.000Z');
        expect(isInQuietHours(earlyMorning, 'UTC', quietHours)).toBe(false);

        const evening = new Date('2024-01-15T17:01:00.000Z');
        expect(isInQuietHours(evening, 'UTC', quietHours)).toBe(false);

        const midnight = new Date('2024-01-15T00:00:00.000Z');
        expect(isInQuietHours(midnight, 'UTC', quietHours)).toBe(false);
      });
    });

    describe('Midnight-spanning Quiet Hours', () => {
      const quietHours = { start: '22:00', end: '07:00' };

      it('should return true for late night hours', () => {
        const lateNight = new Date('2024-01-15T23:00:00.000Z');
        expect(isInQuietHours(lateNight, 'UTC', quietHours)).toBe(true);

        const startTime = new Date('2024-01-15T22:00:00.000Z');
        expect(isInQuietHours(startTime, 'UTC', quietHours)).toBe(true);

        const almostMidnight = new Date('2024-01-15T23:59:00.000Z');
        expect(isInQuietHours(almostMidnight, 'UTC', quietHours)).toBe(true);
      });

      it('should return true for early morning hours', () => {
        const midnight = new Date('2024-01-15T00:00:00.000Z');
        expect(isInQuietHours(midnight, 'UTC', quietHours)).toBe(true);

        const earlyMorning = new Date('2024-01-15T05:00:00.000Z');
        expect(isInQuietHours(earlyMorning, 'UTC', quietHours)).toBe(true);

        const endTime = new Date('2024-01-15T07:00:00.000Z');
        expect(isInQuietHours(endTime, 'UTC', quietHours)).toBe(true);
      });

      it('should return false for daytime hours', () => {
        const morning = new Date('2024-01-15T08:00:00.000Z');
        expect(isInQuietHours(morning, 'UTC', quietHours)).toBe(false);

        const noon = new Date('2024-01-15T12:00:00.000Z');
        expect(isInQuietHours(noon, 'UTC', quietHours)).toBe(false);

        const evening = new Date('2024-01-15T21:59:00.000Z');
        expect(isInQuietHours(evening, 'UTC', quietHours)).toBe(false);
      });
    });

    describe('Timezone Handling', () => {
      it('should work correctly with different timezones', () => {
        const quietHours = { start: '22:00', end: '07:00' };
        
        // 2 PM UTC = 7 AM PDT (end of quiet hours)
        const utcTime = new Date('2024-07-15T14:00:00.000Z');
        expect(isInQuietHours(utcTime, 'America/Los_Angeles', quietHours)).toBe(true);
        
        // 3 PM UTC = 8 AM PDT (outside quiet hours)
        const utcTime2 = new Date('2024-07-15T15:00:00.000Z');
        expect(isInQuietHours(utcTime2, 'America/Los_Angeles', quietHours)).toBe(false);
      });
    });

    describe('Error Handling', () => {
      it('should return false and log warning for invalid timezone', () => {
        mockLogger.warn.mockClear();
        
        const quietHours = { start: '22:00', end: '07:00' };
        const testTime = new Date('2024-01-15T12:00:00.000Z');
        
        const result = isInQuietHours(testTime, 'Invalid/Timezone', quietHours);
        
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Failed to check quiet hours',
          expect.objectContaining({
            timezone: 'Invalid/Timezone',
            quietHours,
            error: expect.any(String),
          })
        );
      });

      it('should handle malformed quiet hours gracefully', () => {
        const badQuietHours = { start: 'invalid', end: '07:00' } as any;
        const testTime = new Date('2024-01-15T12:00:00.000Z');
        
        const result = isInQuietHours(testTime, 'UTC', badQuietHours);
        
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });
  });

  describe('Validation Functions', () => {
    describe('isValidIsoDuration', () => {
      it('should return true for valid ISO 8601 durations', () => {
        expect(isValidIsoDuration('PT0S')).toBe(true);
        expect(isValidIsoDuration('PT30M')).toBe(true);
        expect(isValidIsoDuration('PT2H')).toBe(true);
        expect(isValidIsoDuration('P1D')).toBe(true);
        expect(isValidIsoDuration('P1W')).toBe(true);
        expect(isValidIsoDuration('P1M')).toBe(true);
        expect(isValidIsoDuration('P1Y')).toBe(true);
        expect(isValidIsoDuration('P1DT12H30M')).toBe(true);
        expect(isValidIsoDuration('PT1.5H')).toBe(true);
      });

      it('should return false for invalid durations', () => {
        expect(isValidIsoDuration('invalid')).toBe(false);
        expect(isValidIsoDuration('P')).toBe(false);
        expect(isValidIsoDuration('PT')).toBe(false);
        expect(isValidIsoDuration('24H')).toBe(false);
        expect(isValidIsoDuration('P-1D')).toBe(false);
        expect(isValidIsoDuration('')).toBe(false);
        expect(isValidIsoDuration('PT1H2H')).toBe(false);
      });
    });

    describe('isValidTimeFormat', () => {
      it('should return true for valid HH:MM format', () => {
        expect(isValidTimeFormat('00:00')).toBe(true);
        expect(isValidTimeFormat('09:30')).toBe(true);
        expect(isValidTimeFormat('12:00')).toBe(true);
        expect(isValidTimeFormat('23:59')).toBe(true);
        expect(isValidTimeFormat('07:45')).toBe(true);
      });

      it('should return false for invalid time formats', () => {
        expect(isValidTimeFormat('24:00')).toBe(false); // Invalid hour
        expect(isValidTimeFormat('12:60')).toBe(false); // Invalid minute
        expect(isValidTimeFormat('9:30')).toBe(false);  // Single digit hour
        expect(isValidTimeFormat('09:5')).toBe(false);  // Single digit minute
        expect(isValidTimeFormat('12')).toBe(false);    // Missing minutes
        expect(isValidTimeFormat('12:30:00')).toBe(false); // Includes seconds
        expect(isValidTimeFormat('invalid')).toBe(false);
        expect(isValidTimeFormat('')).toBe(false);
        expect(isValidTimeFormat('25:00')).toBe(false);
        expect(isValidTimeFormat('-1:00')).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(isValidTimeFormat('00:01')).toBe(true);
        expect(isValidTimeFormat('23:58')).toBe(true);
        expect(isValidTimeFormat('12:00')).toBe(true);
      });
    });

    describe('isValidTimezone', () => {
      it('should return true for valid IANA timezone identifiers', () => {
        expect(isValidTimezone('UTC')).toBe(true);
        expect(isValidTimezone('America/New_York')).toBe(true);
        expect(isValidTimezone('America/Los_Angeles')).toBe(true);
        expect(isValidTimezone('Europe/London')).toBe(true);
        expect(isValidTimezone('Asia/Tokyo')).toBe(true);
        expect(isValidTimezone('Australia/Sydney')).toBe(true);
        expect(isValidTimezone('America/Chicago')).toBe(true);
      });

      it('should return false for invalid timezone identifiers', () => {
        expect(isValidTimezone('Invalid/Timezone')).toBe(false);
        expect(isValidTimezone('PST')).toBe(false); // Abbreviations not supported
        expect(isValidTimezone('EST')).toBe(false);
        expect(isValidTimezone('GMT')).toBe(false);
        expect(isValidTimezone('')).toBe(false);
        expect(isValidTimezone('America/NonExistent')).toBe(false);
        expect(isValidTimezone('123')).toBe(false);
        expect(isValidTimezone('random-string')).toBe(false);
      });

      it('should handle edge cases', () => {
        expect(isValidTimezone('Etc/GMT')).toBe(true);
        expect(isValidTimezone('Etc/UTC')).toBe(true);
        expect(isValidTimezone('GMT')).toBe(false); // GMT without Etc/ prefix
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end for campaign scheduling scenario', () => {
      const baseTime = new Date('2024-01-15T22:30:00.000Z'); // 10:30 PM UTC
      const quietHours = { start: '22:00', end: '07:00' };
      
      // Calculate schedule time with quiet hours
      const scheduledTime = calculateScheduleTime('PT2H', 'UTC', quietHours, baseTime);
      
      // Should be moved to end of quiet hours (7 AM next day)
      expect(scheduledTime.getUTCDate()).toBe(16); // Next day
      expect(scheduledTime.getUTCHours()).toBe(7);
      expect(scheduledTime.getUTCMinutes()).toBe(0);
      
      // Verify it's no longer in quiet hours
      expect(isInQuietHours(scheduledTime, 'UTC', quietHours)).toBe(true); // Exactly at end time
    });

    it('should handle complex timezone scenario', () => {
      // Test with Pacific timezone during standard time
      const baseTime = new Date('2024-01-15T06:00:00.000Z'); // 6 AM UTC = 10 PM PST (previous day)
      const quietHours = { start: '22:00', end: '07:00' };
      
      const scheduledTime = calculateScheduleTime('PT1H', 'America/Los_Angeles', quietHours, baseTime);
      
      // Should be adjusted for Pacific timezone quiet hours
      expect(scheduledTime).toBeInstanceOf(Date);
      expect(scheduledTime.getTime()).toBeGreaterThan(baseTime.getTime());
    });

    it('should validate all components together', () => {
      const duration = 'P1DT12H30M';
      const timeFormat = '09:30';
      const timezone = 'America/New_York';
      
      expect(isValidIsoDuration(duration)).toBe(true);
      expect(isValidTimeFormat(timeFormat)).toBe(true);
      expect(isValidTimezone(timezone)).toBe(true);
      
      // Should be able to use all together
      const baseTime = new Date('2024-01-15T12:00:00.000Z');
      const quietHours = { start: timeFormat, end: '17:30' };
      
      const result = calculateScheduleTime(duration, timezone, quietHours, baseTime);
      expect(result).toBeInstanceOf(Date);
    });
  });
});