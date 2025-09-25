# LangFuse Integration Guide

This document explains how to configure and use LangFuse for observability, tracing, and prompt management in your AI agents.

## Overview

LangFuse provides:

- **Observability**: Monitor agent performance and behavior
- **Tracing**: Track execution flow through your agents
- **Prompt Management**: Version and manage prompts centrally
- **Evaluations**: Assess agent performance with datasets

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

# LangFuse Setup Options
LANGFUSE_MIGRATE_PROMPTS=true
LANGFUSE_CREATE_DATASETS=true
```

### Getting LangFuse Credentials

1. **Cloud Option**: Sign up at [LangFuse Cloud](https://cloud.langfuse.com)
2. **Self-hosted Option**: Deploy LangFuse using Docker:
   ```bash
   git clone https://github.com/langfuse/langfuse.git
   cd langfuse
   docker compose up -d
   ```

## Features

### 1. Agent Tracing

All agents are automatically instrumented with LangFuse tracing:

```typescript
import { siteAnalysisAgent } from '@/modules/ai/langchain/factories/AgentFactory';

// Basic usage with tracing
const result = await siteAnalysisAgent.analyze('example.com');

// Advanced usage with custom metadata
const result = await siteAnalysisAgent.analyze('example.com', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  sessionId: 'custom-session-id',
  enableTracing: true,
  metadata: {
    campaign: 'Q1-2024',
    source: 'web-app',
  },
});
```

### 2. Prompt Management

Prompts can be managed centrally in LangFuse and will automatically fallback to local versions:

```typescript
import { promptService } from '@/modules/ai/observability';

// Get prompt (tries remote first, falls back to local)
const { prompt, promptConfig } = await promptService.getPrompt('summarize_site');

// Get specific version
const { prompt } = await promptService.getPrompt('summarize_site', { version: 2 });

// Create/update prompt in LangFuse
await promptService.createOrUpdatePrompt(
  'new_prompt',
  'Your prompt template here with {{variables}}',
  { model: 'gpt-4o-mini', temperature: 0 },
  ['production']
);
```

### 3. Event Logging

Log custom events for tracking:

```typescript
import { langfuseService } from '@/modules/ai/observability';

langfuseService.logEvent(
  'custom_event',
  {
    action: 'user_action',
    data: { key: 'value' },
  },
  {
    tenantId: 'tenant-123',
    userId: 'user-456',
  }
);
```

### 4. Manual Traces

Create custom traces for complex workflows:

```typescript
const trace = langfuseService.createTrace('Complex Workflow', {
  tenantId: 'tenant-123',
  metadata: { workflow: 'lead_analysis' },
});

// Score the trace
if (trace) {
  langfuseService.score(trace.id, 'quality', 0.85, 'Good results');
}
```

## Agent Integration

### Updated Agent Methods

All agents now support additional options for tracing:

#### SiteAnalysisAgent

```typescript
const result = await agent.analyze('domain.com', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  enableTracing: true,
  metadata: { source: 'campaign' },
});
// Returns: { finalResponse, finalResponseParsed, totalIterations, functionCalls, traceId }
```

#### VendorFitAgent

```typescript
const result = await agent.analyzeVendorFit(partnerInfo, opportunityContext, {
  tenantId: 'tenant-123',
  enableTracing: true,
});
```

#### ContactExtractionAgent

```typescript
const result = await agent.extractContacts('domain.com', {
  tenantId: 'tenant-123',
  enableTracing: true,
});
```

#### ContactStrategyAgent

```typescript
const result = await agent.generateEmailContent(tenantId, leadId, contactId, {
  enableTracing: true,
  sessionId: 'custom-session',
});
```

## Monitoring & Evaluation

### Automatic Metrics

Each agent automatically logs:

- Execution start/completion events
- Error events with context
- Performance scores
- Function call traces
- Token usage (when available)

### Evaluation Datasets

The system automatically creates evaluation datasets for:

- `site-analysis-eval`: Site analysis performance
- `vendor-fit-eval`: Vendor fit analysis quality
- `contact-extraction-eval`: Contact extraction accuracy
- `contact-strategy-eval`: Email strategy effectiveness

### Custom Scoring

Agents automatically score their performance:

- Successful completions: 0.8
- Partial completions: 0.5-0.7
- Failures: 0.1

## Startup & Migration

### Automatic Setup

The server automatically:

1. Initializes LangFuse connection
2. Migrates local prompts to LangFuse (if enabled)
3. Creates evaluation datasets (if enabled)
4. Seeds sample evaluation data

### Manual Migration

You can also trigger migration manually:

```typescript
import { migrationService } from '@/modules/ai/observability';

// Migrate prompts
await migrationService.migratePrompts();

// Create datasets
await migrationService.createEvaluationDatasets();

// Full setup
await migrationService.setupLangFuse();
```

## Testing

### Integration Tests

Run the LangFuse integration tests:

```bash
npm test -- src/modules/ai/observability/__tests__/langfuse.integration.test.ts
```

### Live Testing

For live testing with actual LangFuse instance:

```bash
LANGFUSE_ENABLED=true npm test
```

## Troubleshooting

### Common Issues

1. **LangFuse not connecting**
   - Check credentials are correct
   - Verify network connectivity to LangFuse host
   - Check logs for initialization errors

2. **Prompts not syncing**
   - Ensure `LANGFUSE_MIGRATE_PROMPTS=true`
   - Check LangFuse dashboard for uploaded prompts
   - Verify prompt names match exactly

3. **Missing traces**
   - Confirm `LANGFUSE_ENABLED=true`
   - Check if agents are created with `enableTracing: true`
   - Verify callback handlers are properly attached

### Debug Mode

Enable debug logging:

```bash
LANGFUSE_DEBUG=true
```

### Health Check

Check LangFuse integration status:

```typescript
import { migrationService } from '@/modules/ai/observability';

const health = await migrationService.healthCheck();
console.log(health);
// { isReady: boolean, clientAvailable: boolean, error?: string }
```

## Performance Considerations

### Batching & Flushing

- Events are batched and flushed automatically
- Configure batch size: `LANGFUSE_FLUSH_AT=10`
- Configure flush interval: `LANGFUSE_FLUSH_INTERVAL=1000`

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

1. **Structured Logging**: Use consistent metadata across traces
2. **Error Handling**: Always handle LangFuse errors gracefully
3. **Performance Monitoring**: Monitor trace creation and flushing performance
4. **Prompt Versioning**: Use semantic versioning for prompts
5. **Evaluation**: Regularly review and score agent performance

## Support

For issues with:

- **LangFuse integration**: Check this documentation and logs
- **LangFuse platform**: Visit [LangFuse Documentation](https://langfuse.com/docs)
- **Agent performance**: Use LangFuse dashboard for analysis
