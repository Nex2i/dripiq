import { getLangFuseStatus, getObservabilityServices } from './index';

/**
 * Debug utility for troubleshooting LangFuse configuration issues
 */
export const debugLangFuseConfig = async (): Promise<void> => {
  console.log('\n🔍 LangFuse Configuration Debug\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(
    `  LANGFUSE_PUBLIC_KEY: ${process.env.LANGFUSE_PUBLIC_KEY ? `${process.env.LANGFUSE_PUBLIC_KEY.substring(0, 10)}...` : '❌ NOT SET'}`
  );
  console.log(
    `  LANGFUSE_SECRET_KEY: ${process.env.LANGFUSE_SECRET_KEY ? `${process.env.LANGFUSE_SECRET_KEY.substring(0, 10)}...` : '❌ NOT SET'}`
  );
  console.log(`  LANGFUSE_HOST: ${process.env.LANGFUSE_HOST || '❌ NOT SET'}`);
  console.log(`  LANGFUSE_ENABLED: ${process.env.LANGFUSE_ENABLED || '❌ NOT SET'}`);
  console.log(`  LANGFUSE_DEBUG: ${process.env.LANGFUSE_DEBUG || 'false'}`);
  console.log(`  LANGFUSE_FLUSH_AT: ${process.env.LANGFUSE_FLUSH_AT || '10'}`);
  console.log(`  LANGFUSE_FLUSH_INTERVAL: ${process.env.LANGFUSE_FLUSH_INTERVAL || '1000'}`);

  // Check required variables
  const required = [
    'LANGFUSE_PUBLIC_KEY',
    'LANGFUSE_SECRET_KEY',
    'LANGFUSE_HOST',
    'LANGFUSE_ENABLED',
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.log(`\n❌ Missing Required Variables: ${missing.join(', ')}`);
  } else {
    console.log('\n✅ All required environment variables are set');
  }

  // Check LangFuse service status
  console.log('\n🔧 LangFuse Service Status:');
  try {
    const status = getLangFuseStatus();
    console.log(`  Initialized: ${status.initialized ? '✅' : '❌'}`);
    console.log(`  Available: ${status.available ? '✅' : '❌'}`);

    if (status.config) {
      console.log(`  Host: ${status.config.host}`);
      console.log(`  Enabled: ${status.config.enabled}`);
      console.log(`  Debug: ${status.config.debug}`);
    }
  } catch (error) {
    console.log(
      `  ❌ Error getting status: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Try to initialize services
  console.log('\n🚀 Service Initialization Test:');
  try {
    const services = await getObservabilityServices();
    console.log('  ✅ Services initialized successfully');

    if (services.langfuseService.isAvailable()) {
      console.log('  ✅ LangFuse client is available and ready');
    } else {
      console.log('  ❌ LangFuse client is not available');

      // Additional diagnostics
      const config = services.langfuseService.getConfig();
      console.log('  🔍 Config details:');
      console.log(`    - Enabled: ${config.enabled}`);
      console.log(`    - Host: ${config.host}`);
      console.log(`    - Has valid config: ${!!config.enabled && !!config.host}`);
    }
  } catch (error) {
    console.log(
      `  ❌ Service initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Test trace creation
  console.log('\n🧪 Trace Creation Test:');
  try {
    const services = await getObservabilityServices();

    if (services.langfuseService.isAvailable()) {
      const traceResult = services.langfuseService.createTrace(
        'debug-test',
        { test: 'debug' },
        { source: 'debug-utility' }
      );

      if (traceResult.traceId) {
        console.log(`  ✅ Trace created successfully: ${traceResult.traceId}`);

        // Clean up test trace
        if (traceResult.trace) {
          services.langfuseService.updateTrace(
            traceResult.trace,
            { result: 'debug-complete' },
            { completed: true }
          );
        }
      } else {
        console.log('  ❌ Trace creation returned null');
      }
    } else {
      console.log('  ⏭️  Skipped - LangFuse not available');
    }
  } catch (error) {
    console.log(
      `  ❌ Trace creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  console.log('\n🏁 Debug complete\n');
};

/**
 * Simple function to check if LangFuse is properly configured
 */
export const isLangFuseConfigured = (): boolean => {
  const required = [
    'LANGFUSE_PUBLIC_KEY',
    'LANGFUSE_SECRET_KEY',
    'LANGFUSE_HOST',
    'LANGFUSE_ENABLED',
  ];
  const hasAllRequired = required.every((key) => !!process.env[key]);
  const isEnabled = process.env.LANGFUSE_ENABLED === 'true';

  return hasAllRequired && isEnabled;
};

/**
 * Get detailed configuration info for debugging
 */
export const getLangFuseConfigInfo = () => {
  return {
    environment: {
      LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY ? 'SET' : 'NOT SET',
      LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY ? 'SET' : 'NOT SET',
      LANGFUSE_HOST: process.env.LANGFUSE_HOST || 'NOT SET',
      LANGFUSE_ENABLED: process.env.LANGFUSE_ENABLED || 'NOT SET',
      LANGFUSE_DEBUG: process.env.LANGFUSE_DEBUG || 'false',
    },
    validation: {
      hasPublicKey: !!process.env.LANGFUSE_PUBLIC_KEY,
      hasSecretKey: !!process.env.LANGFUSE_SECRET_KEY,
      hasHost: !!process.env.LANGFUSE_HOST,
      isEnabled: process.env.LANGFUSE_ENABLED === 'true',
      isConfigured: isLangFuseConfigured(),
    },
  };
};
