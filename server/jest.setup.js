const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment file if ENV_FILE is specified (for test environment)
if (process.env.ENV_FILE) {
  dotenv.config({ path: process.env.ENV_FILE });
} else {
  dotenv.config();
}

// Set timezone to UTC for all tests to avoid timezone-related failures
process.env.TZ = 'UTC';

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Auto-populate test environment variables from .example.env
// This ensures all required env vars are set with dummy values for testing
const exampleEnvPath = path.join(__dirname, '.example.env');

if (fs.existsSync(exampleEnvPath)) {
  const exampleEnvContent = fs.readFileSync(exampleEnvPath, 'utf-8');
  const lines = exampleEnvContent.split('\n');

  lines.forEach((line) => {
    // Skip comments and empty lines
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    // Extract variable name (everything before the first '=')
    const match = trimmedLine.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const varName = match[1];

      // Only set if not already defined
      if (!process.env[varName]) {
        // Set appropriate test values based on variable name patterns
        if (varName.includes('KEY') || varName.includes('SECRET') || varName.includes('PASSWORD')) {
          process.env[varName] = `test-${varName.toLowerCase()}`;
        } else if (varName.includes('URL') || varName.includes('HOST')) {
          process.env[varName] = `https://test-${varName.toLowerCase()}.example.com`;
        } else if (varName.includes('PORT')) {
          process.env[varName] = '3000';
        } else if (varName.includes('ID')) {
          process.env[varName] = `test-${varName.toLowerCase()}-123`;
        } else if (varName === 'NODE_ENV') {
          process.env[varName] = 'test';
        } else if (varName === 'CREDENTIALS') {
          process.env[varName] = 'true';
        } else {
          process.env[varName] = `test-${varName.toLowerCase()}`;
        }
      }
    }
  });
}
