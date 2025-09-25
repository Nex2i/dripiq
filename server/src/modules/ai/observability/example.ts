/**
 * Example usage of the new LangFuse observability system
 */

import { 
  initializeObservability,
  getObservabilityHealthStatus,
  langfuseService,
  promptService 
} from './index';

// Example: Initialize the observability system at application startup
export async function setupObservability() {
  console.log('Initializing observability system...');
  
  const result = await initializeObservability({
    validatePrompts: true,
    requiredPrompts: ['summarize_site', 'vendor_fit', 'extract_contacts', 'contact_strategy'],
    environment: process.env.NODE_ENV === 'production' ? 'prod' : 'local',
  });

  if (result.success) {
    console.log('✅ Observability system initialized successfully');
    console.log(`LangFuse available: ${result.langfuse.available}`);
    console.log(`Prompts validated: ${result.prompts.validatedCount}/${result.prompts.validatedCount || 0}`);
  } else {
    console.warn('⚠️ Observability system initialized with issues:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }

  // Check health status
  const health = getObservabilityHealthStatus();
  console.log('Health status:', {
    overall: health.overall.healthy ? '✅ Healthy' : '❌ Unhealthy',
    langfuse: health.langfuse.isAvailable ? '✅ Available' : '❌ Unavailable',
    prompts: `📊 ${health.prompts.cacheStats.size} cached`,
  });

  return result;
}

// Example: Using the enhanced agents with observability
export async function exampleAgentUsage() {
  // Import the enhanced agents
  const { SiteAnalysisAgent } = await import('../langchain/agents/SiteAnalysisAgent');
  const { defaultLangChainConfig } = await import('../langchain/config/langchain.config');

  // Create agent instance
  const agent = new SiteAnalysisAgent(defaultLangChainConfig);

  // BEFORE: Simple usage
  // const result = await agent.analyze('example.com');

  // AFTER: Enhanced usage with full observability
  const result = await agent.analyze('example.com', {
    tenantId: 'tenant-123',
    userId: 'user-456', 
    sessionId: 'session-789',
    enableTracing: true,
    metadata: {
      campaign: 'Q1-2024',
      source: 'webapp',
      version: '2.0',
    },
    tags: ['production', 'analysis'],
  });

  console.log('Analysis Result:', {
    success: !!result.finalResponseParsed,
    traceId: result.traceId,
    duration: result.executionMetadata?.duration,
    iterations: result.totalIterations,
    functionCalls: result.functionCalls.length,
  });

  return result;
}

// Example: Manual prompt usage
export async function examplePromptUsage() {
  // Fetch a prompt from LangFuse
  const promptResult = await promptService.getPrompt('summarize_site', {
    environment: 'prod',
    cacheTtlSeconds: 300, // 5 minutes cache
  });

  console.log('Prompt fetched:', {
    version: promptResult.version,
    cached: promptResult.cached,
    length: promptResult.prompt.length,
  });

  // Inject variables
  const finalPrompt = promptService.injectVariables(promptResult.prompt, {
    domain: 'example.com',
    additional_context: 'Focus on AI capabilities',
  });

  console.log('Prompt ready for use:', finalPrompt.substring(0, 100) + '...');

  return finalPrompt;
}

// Example: Manual tracing
export async function exampleManualTracing() {
  if (!langfuseService.isAvailable()) {
    console.log('LangFuse not available, skipping tracing example');
    return;
  }

  // Create a trace for custom workflow
  const trace = langfuseService.createTrace('custom_workflow', {
    tenantId: 'tenant-123',
    userId: 'user-456',
    metadata: {
      workflow: 'data_processing',
      version: '1.0',
    },
    tags: ['custom', 'workflow'],
  });

  // Create spans for different steps
  const dataFetchSpan = langfuseService.createSpan(trace, {
    name: 'data_fetch',
    input: { source: 'database', query: 'SELECT * FROM leads' },
  });

  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 100));

  langfuseService.updateElement(dataFetchSpan, {
    output: { recordCount: 150, success: true },
  });
  langfuseService.endElement(dataFetchSpan);

  // Create another span
  const processingSpan = langfuseService.createSpan(trace, {
    name: 'data_processing',
    input: { algorithm: 'machine_learning', recordCount: 150 },
  });

  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 200));

  langfuseService.updateElement(processingSpan, {
    output: { processedRecords: 150, accuracy: 0.95 },
  });
  langfuseService.endElement(processingSpan);

  // Score the trace
  langfuseService.score(trace, 'processing_accuracy', 0.95, 'High accuracy achieved');

  // End the trace
  langfuseService.endElement(trace, {
    output: { success: true, totalRecords: 150 },
  });

  console.log('Custom workflow traced:', trace.id);
  
  return trace.id;
}

// Example: Error handling with observability
export async function exampleErrorHandling() {
  try {
    const { VendorFitAgent } = await import('../langchain/agents/VendorFitAgent');
    const { defaultLangChainConfig } = await import('../langchain/config/langchain.config');

    const agent = new VendorFitAgent(defaultLangChainConfig);

    const result = await agent.analyzeVendorFit(
      { /* invalid partner info */ },
      'test opportunity',
      {
        tenantId: 'tenant-123',
        enableTracing: true,
        metadata: { errorTest: true },
      }
    );

    return result;
  } catch (error) {
    console.error('Agent execution failed:', {
      type: error.type || 'unknown',
      message: error.message,
      traceId: error.traceId,
      context: error.context,
    });

    // Error is automatically traced if tracing was enabled
    throw error;
  }
}

// Example: Cache management
export async function exampleCacheManagement() {
  // Check current cache status
  const initialStats = promptService.getCacheStats();
  console.log('Initial cache stats:', initialStats);

  // Fetch some prompts to populate cache
  await Promise.all([
    promptService.getPrompt('summarize_site'),
    promptService.getPrompt('vendor_fit'),
    promptService.getPrompt('extract_contacts', { environment: 'prod' }),
  ]);

  const populatedStats = promptService.getCacheStats();
  console.log('Cache after population:', populatedStats);

  // Clear specific prompt
  promptService.clearCache('summarize_site', 'local');

  // Clear entire cache
  promptService.clearCache();

  const clearedStats = promptService.getCacheStats();
  console.log('Cache after clearing:', clearedStats);
}