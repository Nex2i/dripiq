/**
 * LangFuse Debug Script
 * 
 * Run this script to debug LangFuse configuration issues:
 * node debug-langfuse.js
 */

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

console.log('\n🔍 LangFuse Configuration Debug\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`  LANGFUSE_PUBLIC_KEY: ${process.env.LANGFUSE_PUBLIC_KEY ? `${process.env.LANGFUSE_PUBLIC_KEY.substring(0, 10)}...` : '❌ NOT SET'}`);
console.log(`  LANGFUSE_SECRET_KEY: ${process.env.LANGFUSE_SECRET_KEY ? `${process.env.LANGFUSE_SECRET_KEY.substring(0, 10)}...` : '❌ NOT SET'}`);
console.log(`  LANGFUSE_HOST: ${process.env.LANGFUSE_HOST || '❌ NOT SET'}`);
console.log(`  LANGFUSE_ENABLED: ${process.env.LANGFUSE_ENABLED || '❌ NOT SET'}`);
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// Check required variables
const required = ['LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_HOST', 'LANGFUSE_ENABLED'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.log(`\n❌ Missing Required Variables: ${missing.join(', ')}`);
  console.log('\n💡 Solutions:');
  console.log('1. Check that your .env file exists in the server/ directory');
  console.log('2. Verify the variable names are exactly: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_HOST, LANGFUSE_ENABLED');
  console.log('3. Make sure LANGFUSE_ENABLED=true (not True or TRUE)');
  console.log('4. Restart your server after updating .env');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set');

// Check if enabled
if (process.env.LANGFUSE_ENABLED !== 'true') {
  console.log('\n⚠️  LANGFUSE_ENABLED is not set to "true"');
  console.log(`   Current value: "${process.env.LANGFUSE_ENABLED}"`);
  console.log('   Set LANGFUSE_ENABLED=true in your .env file');
  process.exit(1);
}

console.log('\n✅ LangFuse is enabled');

// Test LangFuse client initialization
console.log('\n🧪 Testing LangFuse Client:');

(async () => {
  try {
    const { Langfuse } = require('langfuse');
    
    const client = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST,
    });

    console.log('✅ LangFuse client created successfully');
    
    // Test basic trace creation
    const trace = client.trace({
      name: 'debug-test',
      input: { test: 'configuration-check' },
      metadata: { source: 'debug-script' }
    });
    
    console.log(`✅ Test trace created: ${trace.id}`);
    
    // Update trace to complete it
    trace.update({
      output: { status: 'success' },
      metadata: { completed: true }
    });
    
    console.log('✅ Test trace updated successfully');
    
    // Flush to send data
    await client.flushAsync();
    console.log('✅ Data flushed to LangFuse');
    
    // Shutdown client
    await client.shutdownAsync();
    console.log('✅ Client shutdown successfully');
    
    console.log('\n🎉 LangFuse configuration is working correctly!');
    console.log('\n💡 If you still get errors in your application:');
    console.log('1. Make sure you call initializeObservability() before using agents');
    console.log('2. Check that your server is using the same .env file');
    console.log('3. Restart your server to pick up environment changes');

  } catch (error) {
    console.log(`❌ LangFuse client test failed: ${error.message}`);
    console.log('\n💡 Common issues:');
    console.log('1. Invalid API keys - check your LangFuse dashboard');
    console.log('2. Network connectivity - can you reach the LangFuse host?');
    console.log('3. Incorrect host URL - should be https://cloud.langfuse.com or your self-hosted URL');
    console.log('4. npm install langfuse - make sure the package is installed');
  }
})();

console.log('\n');