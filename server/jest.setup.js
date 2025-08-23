const dotenv = require('dotenv');

// Load environment file if ENV_FILE is specified (for test environment)
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE });
} else {
  dotenv.config();
}

// Set timezone to UTC for all tests to avoid timezone-related failures
process.env.TZ = 'UTC';

// Optional: Also set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
