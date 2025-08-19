/**
 * Configuration constants for timeout job management
 *
 * These constants control the behavior of campaign timeout jobs, including:
 * - How long timeout jobs are retained in BullMQ after completion/failure
 * - Default timeout delays for email engagement events
 * - Job cleanup policies to prevent Redis memory bloat
 */

// Timeout job retention settings (in seconds)
// Controls how long completed/failed jobs are kept in Redis for debugging
export const TIMEOUT_JOB_COMPLETE_RETENTION_SECONDS = 60 * 60; // 1 hour
export const TIMEOUT_JOB_FAIL_RETENTION_SECONDS = 24 * 60 * 60; // 24 hours

// Maximum number of completed/failed jobs to retain
// Prevents unbounded Redis memory growth by limiting job history
export const TIMEOUT_JOB_COMPLETE_RETENTION_COUNT = 100;
export const TIMEOUT_JOB_FAIL_RETENTION_COUNT = 50;

// Default timeout delays (ISO 8601 duration strings)
// Used when campaign plan doesn't specify custom timeout values
export const DEFAULT_NO_OPEN_TIMEOUT = 'PT72H'; // 72 hours - time to wait for email open
export const DEFAULT_NO_CLICK_TIMEOUT = 'PT24H'; // 24 hours - time to wait for link click

/**
 * BullMQ job options for timeout jobs
 * Combines retention settings into a reusable configuration object
 */
export const TIMEOUT_JOB_OPTIONS = {
  removeOnComplete: {
    age: TIMEOUT_JOB_COMPLETE_RETENTION_SECONDS,
    count: TIMEOUT_JOB_COMPLETE_RETENTION_COUNT,
  },
  removeOnFail: {
    age: TIMEOUT_JOB_FAIL_RETENTION_SECONDS,
    count: TIMEOUT_JOB_FAIL_RETENTION_COUNT,
  },
} as const;
