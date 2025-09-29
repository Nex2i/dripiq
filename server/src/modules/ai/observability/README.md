# LangFuse-First AI Agent Observability System

This module provides a comprehensive LangFuse-first observability system for all AI agents. **No backward compatibility** - this is a complete replacement of the old prompt system.

## 🚨 Breaking Changes - LangFuse Required

**IMPORTANT**: This system requires LangFuse to be configured and available. There are **no fallbacks** to local prompts.

- ✅ **LangFuse Required**: All agents require LangFuse observability to function
- ✅ **Prompts in LangFuse**: All prompts must be configured in LangFuse dashboard
- ✅ **No Local Fallbacks**: System will fail fast if LangFuse is unavailable
- ✅ **Enhanced Tracing**: Full execution tracing for all agent operations
- ✅ **Required Parameters**: All agent methods now require `AgentExecutionOptions`

## Quick Start

### 1. Environment Configuration

**Required** environment variables in your `.env` file:

```bash
# LangFuse Core (REQUIRED)
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLED=true

# Performance Tuning (Optional)
LANGFUSE_DEBUG=false
LANGFUSE_FLUSH_AT=10
LANGFUSE_FLUSH_INTERVAL=1000
```

### 2. Initialize Observability System

**REQUIRED** during application startup:

```typescript
import { initializeObservability, initializeAgents } from '@/modules/ai';

// Initialize observability services first
await initializeObservability();

// Then initialize agents (will fail if observability not available)
await initializeAgents();

console.log('AI system ready with LangFuse observability');
```

### 3. Configure Prompts in LangFuse

**REQUIRED**: Create these prompts in your LangFuse dashboard:

| Prompt Name | Environment Tags | Variables |
|-------------|------------------|-----------|
| `summarize_site` | `local`, `production` | `{{domain}}` |
| `vendor_fit` | `local`, `production` | `{{partner_details}}`, `{{opportunity_details}}` |
| `extract_contacts` | `local`, `production` | `{{domain}}`, `{{webdata_contacts}}` |
| `contact_strategy` | `local`, `production` | None (structured data) |

## Agent Usage (New API)

### Site Analysis Agent

```typescript
import { siteAnalysisAgent } from '@/modules/ai';

// REQUIRED: AgentExecutionOptions parameter
const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123',           // Required for tracing
  userId: 'user-456',               // Optional but recommended
  sessionId: 'session-789',         // Optional but recommended
  metadata: { 
    source: 'manual-analysis',      // Custom metadata
    campaign: 'Q1-2024' 
  },
  promptCacheTtl: 300,             // Optional: Custom cache TTL
});

// Enhanced result with tracing
console.log('Analysis completed:', {
  traceId: result.traceId,          // LangFuse trace ID
  executionTime: result.metadata?.executionTimeMs,
  domain: result.finalResponseParsed.summary
});
```

### Vendor Fit Agent

```typescript
import { vendorFitAgent } from '@/modules/ai';

const result = await vendorFitAgent.analyzeVendorFit(
  partnerInfo,
  opportunityContext,
  {
    tenantId: 'tenant-123',         // Required
    userId: 'user-456',
    metadata: { dealId: 'deal-789' }
  }
);
```

### Contact Extraction Agent

```typescript
import { contactExtractionAgent } from '@/modules/ai';

const result = await contactExtractionAgent.extractContacts('example.com', {
  tenantId: 'tenant-123',           // Required
  metadata: { source: 'lead-analysis' },
  promptCacheTtl: 600,              // 10 minutes cache
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
    tenantId: 'tenant-123',         // Required (can be same as first param)
    metadata: { campaignType: 'cold-outreach' }
  }
);
```

## Enhanced Result Structure

All agents return `EnhancedAgentResult<T>`:

```typescript
interface EnhancedAgentResult<T> {
  finalResponse: string;                    // Raw agent response
  finalResponseParsed: T;                   // Parsed & validated result
  totalIterations: number;                  // Tool call iterations
  functionCalls: any[];                     // All tool calls made
  traceId: string;                          // LangFuse trace ID (always present)
  metadata: {
    executionTimeMs: number;                // Total execution time
    agentMetadata: {                        // Agent-specific metadata
      domain?: string;
      promptVersion?: string;
      promptCached?: boolean;
      // ... more agent-specific data
    };
    errors?: Array<{                        // Error details if any
      message: string;
      phase: string;
      timestamp: string;
    }>;
  };
}
```

## Error Handling

### Fail-Fast Approach

The system fails immediately if LangFuse is not available:

```typescript
try {
  const result = await siteAnalysisAgent.analyze('example.com', {
    tenantId: 'tenant-123'
  });
} catch (error) {
  // Error will include trace ID and detailed context
  console.error('Analysis failed:', {
    message: error.message,
    traceId: error.traceId,           // LangFuse trace ID
    metadata: error.metadata          // Execution context
  });
}
```

### Required Configuration Errors

```typescript
// If LangFuse not configured:
// Error: LangFuse service is not available. Site analysis requires observability services.

// If prompt not found in LangFuse:
// Error: LangFuse prompt retrieval not yet implemented for 'summarize_site'. 
// Please configure the prompt 'summarize_site' in your LangFuse dashboard.
```

## Observability Features

### Automatic Tracing

Every agent execution creates a detailed LangFuse trace:

```typescript
// Trace includes:
// - Agent execution lifecycle
// - Prompt retrieval (cached/fresh)
// - Tool calls and results
// - Performance metrics
// - Error context
// - Business metadata (tenant, user, session)
```

### Health Monitoring

```typescript
import { observabilityStartup } from '@/modules/ai/observability';

const healthChecks = await observabilityStartup.performHealthChecks();

healthChecks.forEach(check => {
  console.log(`${check.service}: ${check.healthy ? 'OK' : 'FAIL'}`);
  if (!check.healthy) {
    throw new Error(`${check.service} is unhealthy: ${check.message}`);
  }
});
```

### Prompt Management

```typescript
import { getObservabilityServices } from '@/modules/ai/observability';

const { promptService } = await getObservabilityServices();

// Get prompt with variables
const { prompt } = await promptService.getPromptWithVariables(
  'summarize_site',
  { domain: 'example.com' },
  { cacheTtlSeconds: 300 }
);

// Cache statistics
const stats = promptService.getCacheStats();
console.log(`Cached prompts: ${stats.totalEntries}`);
```

## Migration from Old System

### Breaking Changes Summary

1. **No Optional Parameters**: All agent methods require `AgentExecutionOptions`
2. **No Local Prompts**: All prompts must be in LangFuse
3. **Required Tracing**: All executions must have valid trace context
4. **Fail Fast**: No graceful degradation - system requires LangFuse

### Old vs New API

```typescript
// ❌ OLD (no longer supported)
const result = await siteAnalysisAgent.analyze('example.com');

// ✅ NEW (required)
const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123'  // Minimum required
});
```

### Required Migration Steps

1. **Configure LangFuse**: Set up LangFuse account and get API keys
2. **Create Prompts**: Upload all 4 required prompts to LangFuse dashboard
3. **Update Code**: Add required `AgentExecutionOptions` to all agent calls
4. **Initialize System**: Call `initializeObservability()` and `initializeAgents()` at startup
5. **Handle Errors**: Update error handling for new fail-fast behavior

## Production Deployment

### Startup Sequence

```typescript
// 1. Initialize observability first
await initializeObservability();

// 2. Verify health
const health = await observabilityStartup.performHealthChecks();
if (health.some(check => !check.healthy)) {
  throw new Error('Observability system not healthy');
}

// 3. Initialize agents
await initializeAgents();

// 4. Ready to handle requests
console.log('AI system ready for production');
```

### Environment-Specific Prompts

LangFuse automatically selects prompts based on `NODE_ENV`:

- **Development**: Prompts tagged with `local` environment
- **Production**: Prompts tagged with `production` environment

### Monitoring & Alerts

Set up monitoring for:

- ✅ LangFuse connectivity (health checks)
- ✅ Agent execution times (performance)
- ✅ Error rates (reliability)
- ✅ Prompt cache hit rates (efficiency)

## Advanced Configuration

### Custom Observability Config

```typescript
import { LangFuseService } from '@/modules/ai/observability';

const customConfig = {
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  host: process.env.LANGFUSE_HOST,
  enabled: true,
  debug: process.env.NODE_ENV === 'development',
  flushAt: 5,                    // Flush after 5 traces
  flushInterval: 500,            // Flush every 500ms
};

const langfuseService = new LangFuseService(customConfig);
```

### Performance Tuning

```typescript
// High-volume settings
LANGFUSE_FLUSH_AT=20
LANGFUSE_FLUSH_INTERVAL=2000
LANGFUSE_DEBUG=false

// Development settings  
LANGFUSE_FLUSH_AT=1
LANGFUSE_FLUSH_INTERVAL=100
LANGFUSE_DEBUG=true
```

## Troubleshooting

### Common Issues

1. **"LangFuse service is not available"**
   - Check environment variables
   - Verify API keys are valid
   - Ensure network connectivity to LangFuse

2. **"Prompt 'X' not found in LangFuse dashboard"**
   - Create the prompt in LangFuse dashboard
   - Ensure environment tags match (`local`/`production`)
   - Verify prompt name spelling

3. **"Agent execution failed"**
   - Check LangFuse trace ID in error for details
   - Verify all required parameters provided
   - Check agent-specific logs

### Debug Mode

Enable comprehensive logging:

```bash
LANGFUSE_DEBUG=true
NODE_ENV=development
```

This provides detailed logs of:
- ✅ LangFuse API calls
- ✅ Prompt retrieval and caching
- ✅ Agent execution steps
- ✅ Error contexts

## Business Impact

### Enterprise Benefits

- ✅ **100% Observability**: Every agent execution fully traced
- ✅ **Centralized Control**: All prompts managed in LangFuse dashboard
- ✅ **Quality Assurance**: Automatic performance tracking and scoring
- ✅ **Debugging Power**: Detailed error context and execution traces
- ✅ **Scalability**: Built for high-volume production workloads
- ✅ **Compliance**: Full audit trail of AI operations

### Operational Excellence

- ✅ **Fail Fast**: Immediate detection of configuration issues
- ✅ **No Silent Failures**: System requires proper setup
- ✅ **Performance Monitoring**: Real-time metrics and analytics
- ✅ **Version Control**: Prompt versioning and rollback capabilities