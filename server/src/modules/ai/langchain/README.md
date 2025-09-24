# LangChain + LangFuse Integration

This directory contains the enhanced AI agent system with LangChain and LangFuse integration for observability, tracing, prompt management, and evaluation capabilities.

## Overview

The system has been upgraded with:

1. **LangFuse Observability**: Complete tracing of AI agent executions
2. **Centralized Prompt Management**: Version-controlled prompts with LangFuse integration
3. **Automated Evaluations**: Quality scoring of agent outputs
4. **Enhanced Error Tracking**: Detailed error reporting and analysis

## Architecture

```
src/modules/ai/langchain/
├── config/
│   ├── langchain.config.ts    # LangChain model configuration
│   └── langfuse.config.ts     # LangFuse client and tracing setup
├── agents/
│   ├── SiteAnalysisAgent.ts   # Site analysis with LangFuse tracing
│   ├── ContactExtractionAgent.ts
│   ├── ContactStrategyAgent.ts
│   └── VendorFitAgent.ts
├── prompts/
│   └── promptManager.ts       # Centralized prompt management
├── evaluations/
│   └── evaluationService.ts   # Automated evaluation system
├── tools/                     # LangChain tools
├── factories/                 # Agent factory functions
└── index.ts                   # Main exports
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# LangFuse Configuration (Observability & Prompt Management)
LANGFUSE_SECRET_KEY=sk-lf-...          # Your LangFuse secret key
LANGFUSE_PUBLIC_KEY=pk-lf-...          # Your LangFuse public key
LANGFUSE_BASE_URL=https://cloud.langfuse.com  # Optional: defaults to cloud
LANGFUSE_RELEASE=1.0.0                 # Optional: release version
```

### Getting LangFuse Credentials

1. Sign up at [LangFuse](https://cloud.langfuse.com)
2. Go to Settings → Projects
3. Create a new project or select existing
4. Copy the Public Key and Secret Key
5. Add them to your environment variables

## Usage

### Basic Agent Usage

The existing agent API remains the same, but now includes automatic tracing:

```typescript
import { siteAnalysisAgent } from '@/modules/ai/langchain';

const result = await siteAnalysisAgent.analyze('example.com');
// Traces are automatically sent to LangFuse
```

### Prompt Management

Use the centralized prompt manager for better version control:

```typescript
import { promptManager } from '@/modules/ai/langchain';

const prompt = await promptManager.getPrompt('summarize_site', {
  domain: 'example.com',
  output_schema: '{...}'
});
```

### Custom Evaluations

Create custom evaluations for your agents:

```typescript
import { evaluationService } from '@/modules/ai/langchain';

const evaluation = await evaluationService.evaluateSiteAnalysis(
  'example.com',
  { summary: 'Expected summary...' }, // Expected output
  actualOutput                        // Actual output
);

console.log(`Score: ${evaluation.evaluation.score}`);
console.log(`Feedback: ${evaluation.evaluation.feedback}`);
```

## Features

### 1. Observability & Tracing

- **Automatic Tracing**: All agent executions are automatically traced
- **Detailed Spans**: Each step of the analysis process is tracked
- **Error Tracking**: Failed executions are logged with detailed context
- **Performance Metrics**: Execution time and token usage tracking

### 2. Prompt Management

- **Version Control**: Prompts are versioned and tracked
- **Variable Injection**: Automatic variable substitution with validation
- **Usage Analytics**: Track which prompts are used most frequently
- **Error Detection**: Missing variables are caught before execution

### 3. Evaluation System

- **Automated Scoring**: AI outputs are automatically evaluated
- **Custom Criteria**: Define your own evaluation criteria
- **Feedback Generation**: Human-readable feedback on agent performance
- **Quality Metrics**: Track agent performance over time

### 4. Error Handling

- **Graceful Degradation**: System continues working even if LangFuse is unavailable
- **Detailed Error Logs**: Comprehensive error reporting
- **Fallback Mechanisms**: Automatic fallbacks for failed evaluations

## Monitoring

### LangFuse Dashboard

1. Log into [LangFuse](https://cloud.langfuse.com)
2. Select your project
3. Navigate to:
   - **Traces**: View detailed execution traces
   - **Observations**: See prompt executions and evaluations
   - **Analytics**: Performance metrics and usage statistics
   - **Prompts**: Manage prompt versions

### Key Metrics to Monitor

- **Agent Success Rate**: Percentage of successful executions
- **Average Execution Time**: Performance monitoring
- **Evaluation Scores**: Quality assessment
- **Error Rates**: System health monitoring
- **Prompt Usage**: Most frequently used prompts

## Development

### Adding New Agents

1. Create your agent in the `agents/` directory
2. Use the `createChatModel()` function for LangFuse integration
3. The agent will automatically inherit tracing capabilities

### Custom Evaluations

1. Extend the `EvaluationService` class
2. Add your evaluation criteria
3. Implement scoring logic
4. Results will be automatically logged to LangFuse

### Prompt Versioning

1. Use `promptManager.createPromptVersion()` to create new versions
2. Old versions are preserved for rollback
3. All changes are tracked in LangFuse

## Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   - Ensure all LangFuse credentials are set
   - Check that variables are properly exported

2. **LangFuse Connection Issues**
   - Verify network connectivity
   - Check API key permissions
   - Review LangFuse service status

3. **Evaluation Failures**
   - Check evaluation criteria definitions
   - Verify input/output formats
   - Review error logs for specific issues

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=langfuse:* npm run dev
```

## Migration Guide

### From Old System

The migration is backward compatible. Existing code will continue to work:

```typescript
// Old way (still works)
import { siteAnalysisAgent } from '@/modules/ai/langchain';

// New way (recommended)
import { siteAnalysisAgent } from '@/modules/ai/langchain';
import { promptManager, evaluationService } from '@/modules/ai/langchain';
```

### Benefits of Migration

- **Better Observability**: Full tracing of all AI operations
- **Quality Assurance**: Automated evaluation of outputs
- **Debugging**: Easier troubleshooting with detailed logs
- **Performance Monitoring**: Track execution times and success rates
- **Prompt Management**: Version control and optimization

## Security

- **API Keys**: Never commit LangFuse credentials to version control
- **Data Privacy**: Sensitive data is not sent to LangFuse
- **Access Control**: Use appropriate API key permissions
- **Audit Logs**: All operations are logged for security review