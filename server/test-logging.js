// Test script to verify logging configuration
require('dotenv').config();
const { logger } = require('./src/libs/logger');

// Test the logger with context
const testError = new Error('Test error message');
const testContext = {
  siteUrl: 'https://example.com',
  error: testError,
  additionalInfo: 'This is a test'
};

console.log('Testing logger with context...');
logger.warn('Test warning message with context', testContext);

console.log('Testing logger info with context...');
logger.info('Test info message with context', { 
  userId: '12345', 
  action: 'test',
  metadata: { key: 'value' }
});

console.log('Testing logger error with context...');
logger.error('Test error message with context', {
  error: testError,
  context: 'test-scenario',
  timestamp: new Date().toISOString()
});

console.log('Logging tests completed.');