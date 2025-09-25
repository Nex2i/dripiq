# LangChain + LangFuse Integration for AI Agent Observability

## Overview

This document describes the comprehensive LangChain and LangFuse integration implemented to provide enterprise-grade observability, tracing, and prompt management for all AI agents in the DripIQ system.

## 🎯 Key Features

### ✅ Complete Observability
- **Full execution tracing** for all AI agent operations
- **Performance metrics** including duration, iterations, token usage
- **Error tracking** with detailed context and stack traces
- **Custom events** for business-specific tracking

### ✅ Centralized Prompt Management
- **LangFuse-first approach** - all prompts managed in LangFuse
- **Environment-based prompts** (local vs prod)
- **Intelligent caching** with configurable TTL
- **Variable injection** with {{variable}} syntax
- **Version tracking** and metadata support

### ✅ Enhanced Agent Capabilities
- **Backward compatible** legacy methods maintained
- **Rich execution context** with tenant, user, session tracking
- **Automatic instrumentation** for tool calls and LLM generations
- **Graceful degradation** when LangFuse is unavailable

## 🏗️ Architecture

### Core Services

```
src/modules/ai/observability/
├── langfuse.service.ts      # Core LangFuse client wrapper
├── prompt.service.ts        # Prompt management with caching
├── startup.ts              # Initialization and health checks
├── base-agent.ts           # Base class for observable agents
├── types.ts                # TypeScript interfaces and types
├── example.ts              # Usage examples
└── __tests__/              # Comprehensive test suite
```

### Service Responsibilities

#### LangFuseService
- Manages LangFuse client lifecycle
- Creates and manages traces, spans, generations, events
- Handles scoring and metadata updates
- Provides health status monitoring

#### PromptService
- Fetches prompts from LangFuse by environment
- Implements intelligent caching with TTL
- Handles variable injection with {{variable}} syntax
- Manages cache statistics and cleanup

#### BaseObservableAgent
- Abstract base class for all observable agents
- Handles tracing lifecycle automatically
- Provides error categorization and handling
- Manages execution metadata collection

## 🚀 Agent Transformations

All 4 existing agents have been enhanced with full observability:

### Before (Legacy Usage)
```typescript
const result = await siteAnalysisAgent.analyze('example.com');
```

### After (Enhanced Usage)
```typescript
const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  sessionId: 'session-789',
  enableTracing: true,
  metadata: { campaign: 'Q1-2024', source: 'webapp' },
  tags: ['production', 'analysis']
});

// Returns enhanced result with observability data
console.log({
  traceId: result.traceId,
  duration: result.executionMetadata?.duration,
  iterations: result.totalIterations,
  success: !!result.finalResponseParsed
});
```

### Enhanced Return Type
```typescript
interface AgentExecutionResult<T> {
  finalResponse: string;
  finalResponseParsed: T;
  totalIterations: number;
  functionCalls: any[];
  traceId?: string;  // LangFuse trace ID
  executionMetadata?: {
    startTime: Date;
    endTime: Date;
    duration: number;
    tokenUsage?: TokenUsage;
  };
}
```

## 🔧 Configuration

### Environment Variables

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

### Required Prompts in LangFuse

| Prompt Name | Agent | Environment |
|-------------|-------|-------------|
| `summarize_site` | SiteAnalysisAgent | local/prod |
| `vendor_fit` | VendorFitAgent | local/prod |
| `extract_contacts` | ContactExtractionAgent | local/prod |
| `contact_strategy` | ContactStrategyAgent | local/prod |

## 🚦 Initialization

### Application Startup
```typescript
import { initializeObservability } from '@/modules/ai/observability';

async function startApp() {
  const result = await initializeObservability({
    validatePrompts: true,
    requiredPrompts: ['summarize_site', 'vendor_fit', 'extract_contacts', 'contact_strategy'],
    environment: process.env.NODE_ENV === 'production' ? 'prod' : 'local'
  });

  if (result.success) {
    console.log('✅ Observability system ready');
  } else {
    console.warn('⚠️ Observability issues:', result.errors);
  }
}
```

### Health Monitoring
```typescript
import { getObservabilityHealthStatus } from '@/modules/ai/observability';

const health = getObservabilityHealthStatus();
console.log({
  overall: health.overall.healthy,
  langfuse: health.langfuse.isAvailable,
  prompts: health.prompts.cacheStats.size
});
```

## 📊 Usage Examples

### 1. Enhanced Agent Execution
```typescript
import { SiteAnalysisAgent } from '@/modules/ai/langchain/agents/SiteAnalysisAgent';

const agent = new SiteAnalysisAgent(defaultLangChainConfig);

// Full observability with context
const result = await agent.execute({ domain: 'example.com' }, {
  tenantId: 'tenant-123',
  userId: 'user-456',
  sessionId: 'session-789',
  enableTracing: true,
  metadata: { 
    campaign: 'Q1-2024',
    source: 'webapp',
    analysisType: 'full'
  },
  tags: ['production', 'site-analysis']
});

console.log('Analysis completed:', {
  success: !!result.finalResponseParsed,
  traceId: result.traceId,
  duration: result.executionMetadata?.duration,
  products: result.finalResponseParsed.products?.length || 0
});
```

### 2. Manual Prompt Management
```typescript
import { promptService } from '@/modules/ai/observability';

// Fetch prompt with caching
const promptResult = await promptService.getPrompt('summarize_site', {
  environment: 'prod',
  cacheTtlSeconds: 300
});

// Inject variables
const finalPrompt = promptService.injectVariables(promptResult.prompt, {
  domain: 'example.com',
  analysis_focus: 'AI capabilities'
});

console.log('Prompt ready:', {
  version: promptResult.version,
  cached: promptResult.cached,
  length: finalPrompt.length
});
```

### 3. Custom Tracing
```typescript
import { langfuseService } from '@/modules/ai/observability';

// Create custom trace
const trace = langfuseService.createTrace('data_processing', {
  tenantId: 'tenant-123',
  metadata: { workflow: 'lead_enrichment' }
});

// Add spans for different steps
const fetchSpan = langfuseService.createSpan(trace, {
  name: 'data_fetch',
  input: { source: 'database' }
});

// ... perform work ...

langfuseService.updateElement(fetchSpan, {
  output: { recordCount: 150 }
});
langfuseService.endElement(fetchSpan);

// Score the trace
langfuseService.score(trace, 'data_quality', 0.95);
langfuseService.endElement(trace);
```

## 🔍 Observability Features

### Automatic Tracing
- **Trace Creation**: Automatic trace for every agent execution
- **Span Management**: Separate spans for prompt fetching, execution, parsing
- **Generation Tracking**: LLM calls with input/output and token usage
- **Event Logging**: Tool calls, errors, and custom business events

### Error Handling
- **Categorized Errors**: `PROMPT_FETCH_ERROR`, `LLM_EXECUTION_ERROR`, etc.
- **Rich Context**: Includes agent name, input data, trace ID
- **Graceful Degradation**: Continues operation when LangFuse unavailable
- **Error Tracing**: Failed executions automatically logged with error details

### Performance Metrics
- **Execution Duration**: Start to finish timing
- **Iteration Counts**: Number of agent iterations
- **Function Call Tracking**: Tool usage and results
- **Token Usage**: Prompt and completion token counts (when available)

## 🧪 Testing

### Test Coverage
- **Unit Tests**: Individual service testing with mocks
- **Integration Tests**: End-to-end workflow testing
- **Error Scenarios**: Comprehensive error handling validation
- **Configuration Tests**: Various environment configurations

### Running Tests
```bash
npm test -- --testPathPattern="observability"
```

## 📈 Monitoring & Analytics

### LangFuse Dashboard
- **Real-time Tracing**: Live execution monitoring
- **Performance Analytics**: Duration, success rates, error patterns
- **Prompt Version Tracking**: A/B testing and performance comparison
- **User Journey Analysis**: Tenant and user-specific insights

### Health Endpoints
```typescript
// Check system health
const health = getObservabilityHealthStatus();

// Cache statistics
const cacheStats = promptService.getCacheStats();

// Flush pending data
await flushObservabilityData();
```

## 🔄 Migration Guide

### For Existing Code
1. **No Breaking Changes**: Legacy methods still work
2. **Gradual Adoption**: Add observability options incrementally
3. **Enhanced Returns**: New return types include observability data

### Example Migration
```typescript
// Before
const result = await contactExtractionAgent.extractContacts('example.com');

// After (enhanced)
const result = await contactExtractionAgent.extractContacts('example.com', {
  tenantId: request.tenantId,
  userId: request.userId,
  enableTracing: true,
  metadata: { source: 'api' }
});

// Access new observability data
if (result.traceId) {
  logger.info('Contact extraction traced', { traceId: result.traceId });
}
```

## 🛡️ Security & Privacy

### Data Handling
- **No PII in Traces**: Careful data sanitization
- **Configurable Logging**: Control what data is sent to LangFuse
- **Secure Credentials**: Environment-based API key management
- **Optional Tracing**: Can be disabled per execution

### Compliance
- **Data Retention**: Configurable in LangFuse
- **Access Control**: LangFuse team and project permissions
- **Audit Trail**: Complete execution history for compliance

## 🚀 Deployment

### Development
```bash
# Set up environment
cp .example.env .env
# Update LangFuse credentials

# Initialize and validate
npm run dev
```

### Production
```bash
# Set production environment variables
LANGFUSE_ENABLED=true
NODE_ENV=production

# Validate prompt availability
curl -X POST /api/v1/health/observability
```

## 🔮 Future Enhancements

### Planned Features
- **Automatic Prompt Optimization**: LangFuse-driven A/B testing
- **Cost Tracking**: Token usage and cost analytics per tenant
- **Custom Metrics**: Business-specific KPI tracking
- **Real-time Alerting**: Error rate and performance alerts

### Extensibility
- **Custom Agents**: Easy creation of new observable agents
- **Tool Instrumentation**: Enhanced tool call tracking
- **Workflow Tracing**: Multi-agent workflow observability

## 📞 Support

### Troubleshooting
1. **Check Health Status**: Use `getObservabilityHealthStatus()`
2. **Validate Configuration**: Ensure all environment variables set
3. **Prompt Validation**: Run `initializeObservability({ validatePrompts: true })`
4. **Cache Issues**: Clear prompt cache with `promptService.clearCache()`

### Common Issues
- **LangFuse Unavailable**: System continues with degraded observability
- **Prompt Not Found**: Check prompt name and environment in LangFuse
- **Slow Performance**: Adjust cache TTL and flush settings
- **Missing Traces**: Verify API keys and network connectivity

---

## Summary

This comprehensive LangChain + LangFuse integration provides enterprise-grade observability for all AI agents while maintaining backward compatibility and graceful degradation. The system is production-ready with extensive testing, proper error handling, and flexible configuration options.