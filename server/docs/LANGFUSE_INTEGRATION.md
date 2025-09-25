# LangFuse Integration Guide

This document explains how to configure and use LangFuse for observability, tracing, and prompt management in your AI agents.

## Overview

LangFuse provides:
- Observability: Monitor agent performance and behavior
- Tracing: Track execution flow through your agents
- Prompt Management: Version and manage prompts centrally
- Evaluations: Assess agent performance with datasets

## Prerequisites

- All prompts must be stored in LangFuse - this integration assumes prompts are already managed in your LangFuse instance
- LangFuse account (Cloud or self-hosted)
- Valid API credentials

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# LangFuse Configuration - Observability, Tracing & Prompt Management
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com
# Alternative for US region: https://us.cloud.langfuse.com
# For self-hosted: http://localhost:3000 or your custom domain

# LangFuse Features
LANGFUSE_ENABLED=true
LANGFUSE_DEBUG=false
LANGFUSE_FLUSH_AT=10
LANGFUSE_FLUSH_INTERVAL=1000
```

### Getting LangFuse Credentials

1. Cloud Option: Sign up at [LangFuse Cloud](https://cloud.langfuse.com)
2. Self-hosted Option: Deploy LangFuse using Docker:
   ```bash
   git clone https://github.com/langfuse/langfuse.git
   cd langfuse
   docker compose up -d
   ```

### Required Prompts in LangFuse

The following prompts must exist in your LangFuse instance:

- `summarize_site` - For site analysis operations
- `vendor_fit` - For vendor fit analysis
- `extract_contacts` - For contact extraction
- `contact_strategy` - For email strategy generation

## Features

### Agent Tracing

All agents are automatically instrumented with LangFuse tracing:

```typescript
import { siteAnalysisAgent } from '@/modules/ai/langchain/factories/AgentFactory';

// Basic usage with tracing
const result = await siteAnalysisAgent.analyze('example.com');

// Advanced usage with custom metadata
const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  sessionId: 'session-789',
  enableTracing: true,
  metadata: {
    campaign: 'Q1-2024',
    source: 'web-app'
  }
});
// Returns: { finalResponse, finalResponseParsed, totalIterations, functionCalls, traceId }
```

### Prompt Management

Prompts are retrieved directly from LangFuse with caching:

```typescript
import { promptService } from '@/modules/ai/observability';

// Get latest prompt version
const { prompt, promptConfig } = await promptService.getPrompt('summarize_site');

// Get specific version
const { prompt } = await promptService.getPrompt('summarize_site', { version: 2 });

// Get with custom cache TTL
const { prompt } = await promptService.getPrompt('summarize_site', { 
  cacheTtlSeconds: 300 // 5 minutes
});

// Create/update prompt in LangFuse
await promptService.createOrUpdatePrompt(
  'new_prompt',
  'Your prompt template here with {{variables}}',
  { model: 'gpt-4o-mini', temperature: 0 },
  ['production']
);

// Inject variables into prompt
const finalPrompt = promptService.injectVariables(prompt, {
  domain: 'example.com',
  output_schema: schemaJson
});
```

### Event Logging

Log custom events for tracking:

```typescript
import { langfuseService } from '@/modules/ai/observability';

langfuseService.logEvent('custom_event', {
  action: 'user_action',
  data: { key: 'value' }
}, {
  tenantId: 'tenant-123',
  userId: 'user-456'
});
```

### Manual Traces

Create custom traces for complex workflows:

```typescript
const trace = langfuseService.createTrace('Complex Workflow', {
  tenantId: 'tenant-123',
  metadata: { workflow: 'lead_analysis' }
});

// Score the trace
if (trace) {
  langfuseService.score(trace.id, 'quality', 0.85, 'Good results');
}
```

## Agent Integration

### Agent Methods

All agents now support additional options for tracing:

#### SiteAnalysisAgent
```typescript
const result = await agent.analyze('domain.com', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  enableTracing: true,
  metadata: { source: 'campaign' }
});
// Returns: { finalResponse, finalResponseParsed, totalIterations, functionCalls, traceId }
```

#### VendorFitAgent
```typescript
const result = await agent.analyzeVendorFit(partnerInfo, opportunityContext, {
  tenantId: 'tenant-123',
  enableTracing: true
});
```

#### ContactExtractionAgent
```typescript
const result = await agent.extractContacts('domain.com', {
  tenantId: 'tenant-123',
  enableTracing: true
});
```

#### ContactStrategyAgent
```typescript
const result = await agent.generateEmailContent(tenantId, leadId, contactId, {
  enableTracing: true,
  sessionId: 'custom-session'
});
```

## Monitoring & Evaluation

### Metrics

Each agent automatically logs:
- Execution start/completion events
- Error events with context
- Performance scores
- Function call traces
- Token usage (when available)

### Scoring

Agents automatically score their performance:
- Successful completions: 0.8
- Partial completions: 0.5-0.7
- Failures: 0.1

### Custom Scoring

```typescript
// Score a specific trace
langfuseService.score(traceId, 'custom_metric', 0.95, 'Excellent output quality');
```

## Startup & Health Checks

### Setup

The server automatically:
1. Initializes LangFuse connection
2. Validates prompt availability
3. Sets up health monitoring

### Health Check

Check LangFuse integration status:

```typescript
import { checkLangFuseHealth } from '@/modules/ai/observability/startup';

const health = await checkLangFuseHealth();
console.log(health);
// { isReady: boolean, clientAvailable: boolean, error?: string }
```

## Testing

### Tests

Run the LangFuse integration tests:

```bash
npm test -- src/modules/ai/observability/__tests__/langfuse.integration.test.ts
```

### Live Testing

For live testing with actual LangFuse instance:

```bash
LANGFUSE_ENABLED=true npm test
```

## Error Handling

### Prompt Not Found

If a prompt is not found in LangFuse:

```typescript
try {
  const { prompt } = await promptService.getPrompt('missing_prompt');
} catch (error) {
  console.error('Prompt not found:', error.message);
  // Handle error appropriately
}
```

### Connection Issues

The service gracefully handles connection issues:
- Agents will fail with clear error messages if prompts can't be retrieved
- Observability features are disabled if LangFuse is unavailable
- Server startup continues even if LangFuse fails to initialize

## Troubleshooting

### Common Issues

1. LangFuse not connecting
   - Check credentials are correct
   - Verify network connectivity to LangFuse host
   - Check logs for initialization errors

2. Prompts not found
   - Ensure all required prompts exist in LangFuse
   - Check prompt names match exactly
   - Verify LangFuse dashboard for uploaded prompts

3. Missing traces
   - Confirm `LANGFUSE_ENABLED=true`
   - Check if agents are created with `enableTracing: true`
   - Verify callback handlers are properly attached

### Debug Mode

Enable debug logging:

```bash
LANGFUSE_DEBUG=true
```

### Cache Management

```typescript
// Clear prompt cache
promptService.clearCache();

// Get cache statistics
const stats = promptService.getCacheStats();
console.log(`Cache has ${stats.size} entries:`, stats.keys);
```

## Performance Considerations

### Caching

- Prompts are cached for 5 minutes by default
- Custom cache TTL can be specified per request
- Cache is automatically invalidated when prompts are updated

### Async Operations

All LangFuse operations are async and non-blocking. Agent performance is not affected by LangFuse latency.

### Memory Usage

The LangFuse client maintains an internal buffer for events. Monitor memory usage in high-throughput environments.

## Security

### API Keys

- Store credentials securely in environment variables
- Use different credentials for different environments
- Rotate keys regularly

### Data Privacy

- LangFuse receives prompts, inputs, and outputs
- Ensure compliance with your data privacy requirements
- Use self-hosted LangFuse for sensitive data

## Best Practices

1. Prompt Management: Use semantic versioning for prompts
2. Error Handling: Always handle LangFuse errors gracefully
3. Performance Monitoring: Monitor trace creation and flushing performance
4. Evaluation: Regularly review and score agent performance
5. Caching: Use appropriate cache TTL for your use case

## Required Prompt Structure

Your prompts in LangFuse should support variable injection using `{{variable_name}}` syntax:

```
Analyze the website {{domain}} and provide a summary.

Output your response as JSON matching this schema:
{{output_schema}}
```

## Support

For issues with:
- LangFuse integration: Check this documentation and logs
- LangFuse platform: Visit [LangFuse Documentation](https://langfuse.com/docs)
- Agent performance: Use LangFuse dashboard for analysis

## Migration Notes

This integration assumes all prompts are already managed in LangFuse. If you're migrating from local prompts:

1. Upload all prompts to LangFuse first
2. Test prompt retrieval works correctly
3. Deploy the updated code
4. Monitor for any missing prompts or errors

The system no longer falls back to local prompts - all prompts must be available in LangFuse for the agents to function.