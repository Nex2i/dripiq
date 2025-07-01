#!/usr/bin/env node

/**
 * Performance testing script for the /api/leads endpoint
 * Measures response times with proper authentication
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  host: 'localhost',
  port: 3000,
  path: '/api/leads',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // You'll need to replace this with a valid JWT token for testing
    Authorization: 'Bearer YOUR_VALID_JWT_TOKEN_HERE',
  },
};

function makeRequest() {
  return new Promise((resolve, reject) => {
    const startTime = process.hrtime.bigint();

    const req = http.request(config, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        resolve({
          statusCode: res.statusCode,
          duration: duration,
          dataLength: data.length,
          success: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function runPerformanceTest(iterations = 10) {
  console.log(`🚀 Running performance test for ${config.path} (${iterations} iterations)`);
  console.log(`📍 Target: ${config.host}:${config.port}${config.path}`);
  console.log('─'.repeat(50));

  const results = [];

  for (let i = 0; i < iterations; i++) {
    try {
      const result = await makeRequest();
      results.push(result);

      const status = result.success ? '✅' : '❌';
      console.log(
        `${status} Request ${i + 1}: ${result.duration.toFixed(2)}ms (${result.statusCode})`
      );

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`❌ Request ${i + 1}: Failed - ${error.message}`);
    }
  }

  // Calculate statistics
  const successfulRequests = results.filter((r) => r.success);

  if (successfulRequests.length === 0) {
    console.log('\n❌ No successful requests to analyze');
    return;
  }

  const durations = successfulRequests.map((r) => r.duration);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  console.log('\n📊 Performance Statistics:');
  console.log('─'.repeat(50));
  console.log(`✅ Successful requests: ${successfulRequests.length}/${iterations}`);
  console.log(`⚡ Average response time: ${avgDuration.toFixed(2)}ms`);
  console.log(`🏃 Fastest response: ${minDuration.toFixed(2)}ms`);
  console.log(`🐌 Slowest response: ${maxDuration.toFixed(2)}ms`);

  // Performance assessment
  if (avgDuration < 50) {
    console.log('🎉 Excellent performance! (< 50ms)');
  } else if (avgDuration < 200) {
    console.log('✅ Good performance (< 200ms)');
  } else if (avgDuration < 500) {
    console.log('⚠️  Acceptable performance (< 500ms)');
  } else {
    console.log('🚨 Poor performance (> 500ms) - needs optimization');
  }
}

// Run the test
if (require.main === module) {
  const iterations = process.argv[2] ? parseInt(process.argv[2]) : 10;

  console.log('🔧 API Performance Test Tool');
  console.log('💡 Note: Make sure to update the JWT token in the script');
  console.log('💡 Usage: node performance-test.js [iterations]');
  console.log('');

  runPerformanceTest(iterations).catch(console.error);
}

module.exports = { runPerformanceTest };
