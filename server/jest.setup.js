// Set timezone to UTC for all tests to avoid timezone-related failures
process.env.TZ = 'UTC';

// Optional: Also set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
