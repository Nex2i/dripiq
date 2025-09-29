# LangFuse + LangChain Integration for AI Agent Observability

This module provides comprehensive observability, tracing, and prompt management for all AI agents using LangFuse.

## Features

- **Complete Observability**: Full visibility into agent performance and behavior
- **Distributed Tracing**: Track execution flow through all agent operations
- **Prompt Management**: Centralized version control and management of prompts in LangFuse
- **Enhanced Error Handling**: Graceful degradation when LangFuse is unavailable
- **Type Safety**: Full TypeScript support with proper error handling

## Quick Start

### 1. Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# LangFuse Core (Required)
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLED=true

# Performance Tuning (Optional)
LANGFUSE_DEBUG=false
LANGFUSE_FLUSH_AT=10
LANGFUSE_FLUSH_INTERVAL=1000
```

### 2. Basic Usage

#### Before (Legacy Agent Usage)
```typescript
const result = await siteAnalysisAgent.analyze('example.com');
```

#### After (Enhanced Agent Usage with Observability)
```typescript
const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  sessionId: 'session-789',
  enableTracing: true,
  metadata: { campaign: 'Q1-2024', source: 'webapp' }
});

// Returns enhanced result with tracing information:
// {
//   finalResponse: string,
//   finalResponseParsed: T,
//   totalIterations: number,
//   functionCalls: any[],
//   traceId: string | null,
//   metadata: {
//     executionTimeMs: number,
//     agentMetadata: {...},
//     errors?: [...]
//   }
// }
```

### 3. Initialize Observability Services

```typescript
import { initializeObservability } from '@/modules/ai/observability';

// Initialize during application startup
const services = await initializeObservability();

// Check service health
const healthChecks = await services.performHealthChecks();
console.log('Observability Status:', healthChecks);
```

## Agent-Specific Usage

### Site Analysis Agent

```typescript
import { siteAnalysisAgent } from '@/modules/ai';

const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123',
  enableTracing: true,
  metadata: { source: 'manual-analysis' }
});

console.log('Analysis completed with trace ID:', result.traceId);
```

### Vendor Fit Agent

```typescript
import { vendorFitAgent } from '@/modules/ai';

const result = await vendorFitAgent.analyzeVendorFit(
  partnerInfo,
  opportunityContext,
  {
    tenantId: 'tenant-123',
    userId: 'user-456',
    enableTracing: true,
    metadata: { dealId: 'deal-789' }
  }
);
```

### Contact Extraction Agent

```typescript
import { contactExtractionAgent } from '@/modules/ai';

const result = await contactExtractionAgent.extractContacts('example.com', {
  tenantId: 'tenant-123',
  enableTracing: true,
  promptCacheTtl: 600, // Cache prompts for 10 minutes
});
```

### Contact Strategy Agent

```typescript
import { contactStrategyAgent } from '@/modules/ai';

const result = await contactStrategyAgent.generateEmailContent(
  tenantId,
  leadId,
  contactId,
  {
    enableTracing: true,
    metadata: { campaignType: 'cold-outreach' }
  }
);
```

## Prompt Management

### LangFuse-First Approach

All prompts are now managed in LangFuse with no local fallbacks:

```typescript
import { getObservabilityServices } from '@/modules/ai/observability';

const { promptService } = await getObservabilityServices();

// Basic prompt retrieval
const { prompt } = await promptService.getPrompt('summarize_site');

// With custom cache TTL
const { prompt } = await promptService.getPrompt('summarize_site', {
  cacheTtlSeconds: 300
});

// Variable injection
const finalPrompt = promptService.injectVariables(template, {
  domain: 'example.com',
  additional_context: 'Enterprise focus'
});
```

### Required Prompts in LangFuse

Set up these prompts in your LangFuse dashboard:

| Prompt Name | Agent | Description |
|------------|-------|-------------|
| `summarize_site` | SiteAnalysisAgent | Website analysis and summarization |
| `vendor_fit` | VendorFitAgent | Partner-opportunity fit analysis |
| `extract_contacts` | ContactExtractionAgent | Contact information extraction |
| `contact_strategy` | ContactStrategyAgent | Email campaign generation |

### Environment-Based Prompts

LangFuse supports environment-specific prompts:
- **Local Development**: Use prompts tagged with `local` environment
- **Production**: Use prompts tagged with `production` environment

## Observability Features

### Automatic Event Logging

The system automatically logs:
- **Agent Start/Stop**: Execution lifecycle tracking
- **Error Events**: Detailed error context and stack traces
- **Performance Metrics**: Execution time, iteration counts, token usage
- **Custom Events**: Business-specific tracking capabilities

### Trace Management

```typescript
// Traces are automatically created for every agent execution
const result = await siteAnalysisAgent.analyze('example.com', {
  enableTracing: true,
  tenantId: 'tenant-123',
  sessionId: 'session-abc'
});

// Access trace information
console.log('Trace ID:', result.traceId);
console.log('Execution time:', result.metadata?.executionTimeMs);
```

### Manual Tracing for Complex Workflows

```typescript
import { getObservabilityServices } from '@/modules/ai/observability';

const { langfuseService } = await getObservabilityServices();

if (langfuseService.isAvailable()) {
  const { trace } = langfuseService.createTrace('custom-workflow', { input });
  
  // Log custom events
  langfuseService.logEvent(trace, 'step-completed', { step: 1 });
  
  // Create spans for detailed tracking
  const span = langfuseService.createSpan(trace, 'data-processing', { records: 100 });
  langfuseService.updateSpan(span, { processed: 100 }, { success: true });
  
  // Update trace with final results
  langfuseService.updateTrace(trace, { result }, { success: true });
}
```

## Error Handling

### Graceful Degradation

The system continues to work even when LangFuse is unavailable:

```typescript
// If LangFuse is down, agents will:
// 1. Fall back to local prompts
// 2. Continue without tracing
// 3. Log warnings but not fail
// 4. Return results with traceId: null

const result = await siteAnalysisAgent.analyze('example.com');
// Will work regardless of LangFuse availability
```

### Error Tracing

All errors are automatically traced:

```typescript
try {
  const result = await siteAnalysisAgent.analyze('invalid-domain', {
    enableTracing: true
  });
} catch (error) {
  // Error details are automatically logged to LangFuse
  console.log('Error trace ID:', error.traceId);
  console.log('Error metadata:', error.metadata);
}
```

## Health Monitoring

### Service Health Checks

```typescript
import { observabilityStartup } from '@/modules/ai/observability';

const healthChecks = await observabilityStartup.performHealthChecks();

healthChecks.forEach(check => {
  console.log(`${check.service}: ${check.healthy ? 'OK' : 'FAIL'}`);
  if (check.details) {
    console.log('Details:', check.details);
  }
});
```

### Cache Statistics

```typescript
const { promptService } = await getObservabilityServices();
const stats = promptService.getCacheStats();

console.log('Prompt cache:', {
  totalEntries: stats.totalEntries,
  expiredEntries: stats.entries.filter(e => e.expired).length
});
```

## Advanced Configuration

### Custom LangFuse Configuration

```typescript
import { LangFuseService } from '@/modules/ai/observability';

const customConfig = {
  publicKey: 'custom-pk',
  secretKey: 'custom-sk',
  host: 'https://custom.langfuse.com',
  enabled: true,
  debug: true,
  flushAt: 5,
  flushInterval: 500
};

const langfuseService = new LangFuseService(customConfig);
```

### Custom Prompt Service

```typescript
import { PromptService } from '@/modules/ai/observability';

const promptService = new PromptService(langfuseService);

// Clear cache manually
promptService.clearCache('summarize_site');

// Get cache statistics
const stats = promptService.getCacheStats();
```

## Migration Guide

### Breaking Changes

⚠️ **Important**: This is a full replacement approach with no backwards compatibility for old prompt systems.

### Updated Agent Signatures

All agent methods now accept an optional `AgentExecutionOptions` parameter:

```typescript
// Old signature
async analyze(domain: string): Promise<SiteAnalysisResult>

// New signature
async analyze(
  domain: string, 
  options: AgentExecutionOptions = {}
): Promise<SiteAnalysisResult>
```

### Enhanced Return Types

All agents now return `EnhancedAgentResult<T>` with additional metadata:

```typescript
interface EnhancedAgentResult<T> {
  finalResponse: string;
  finalResponseParsed: T;
  totalIterations: number;
  functionCalls: any[];
  traceId: string | null;        // NEW
  metadata?: {                   // NEW
    executionTimeMs?: number;
    agentMetadata?: Record<string, any>;
    errors?: Array<{
      message: string;
      phase: string;
      timestamp: string;
    }>;
  };
}
```

## Troubleshooting

### Common Issues

1. **LangFuse Connection Failed**
   - Check environment variables
   - Verify network connectivity
   - Ensure API keys are valid

2. **Prompts Not Found**
   - Verify prompts exist in LangFuse dashboard
   - Check environment-specific prompt tags
   - Ensure prompt names match exactly

3. **Slow Performance**
   - Adjust `LANGFUSE_FLUSH_AT` and `LANGFUSE_FLUSH_INTERVAL`
   - Increase prompt cache TTL
   - Monitor trace volume

### Debug Mode

Enable debug logging:

```bash
LANGFUSE_DEBUG=true
```

This will provide detailed logs of all LangFuse operations.

## Best Practices

1. **Always Use Tracing**: Enable tracing for production workloads to monitor performance
2. **Proper Error Handling**: Always handle agent errors gracefully
3. **Cache Management**: Use appropriate cache TTLs for prompts
4. **Metadata**: Include relevant business context in trace metadata
5. **Health Monitoring**: Regularly check observability service health

## Business Impact

### Immediate Benefits

- **Complete Observability**: Full visibility into agent performance and behavior
- **Centralized Management**: All prompts managed in LangFuse dashboard
- **Quality Assurance**: Automatic scoring and performance tracking
- **Debugging Capabilities**: Detailed traces and error context
- **Performance Monitoring**: Real-time metrics and analytics