# AI Module - LangChain Migration

This module has been migrated from a custom tool calling implementation to use the LangChain framework.

## Overview

The AI system now uses LangChain's robust agent and tool calling infrastructure, providing:

- **Simplified Architecture**: Replaced custom tool calling loops with LangChain's built-in agent execution
- **Better Error Handling**: LangChain's comprehensive error management and retry logic
- **Structured Output**: Automatic JSON schema validation and parsing
- **Enhanced Debugging**: Built-in tracing and logging capabilities
- **Future-Proof**: Easy integration with new LangChain features and tools

## Key Components

### Configuration
- `langchain/config/langchain.config.ts` - Central configuration for LangChain models
- Default model: `gpt-4.1-mini`
- Configurable temperature, max tokens, iterations, and timeouts
- **Responses API**: Explicitly configured with `useResponsesApi: true` to use OpenAI's modern Responses API
- Ensures optimal performance for tool calling and structured output operations

### Prompts
All prompts are now managed centrally in the `/prompts` directory:
- Uses `promptHelper.getPromptAndInject()` for dynamic variable injection
- Converts Zod schemas to JSON Schema format using `zodToJsonSchema()`
- No more inline prompts in the code

### Tools
All tools have been converted to LangChain `DynamicTool` format:

- `RetrieveFullPageTool` - Downloads and converts HTML to Markdown
- `GetInformationAboutDomainTool` - Semantic search within domain content  
- `ListDomainPagesTool` - Lists available pages for a domain

### Agents
- `SiteAnalysisAgent` - Uses `summarize_site` prompt for comprehensive website analysis
- `VendorFitAgent` - Uses `vendor_fit` prompt for vendor-opportunity fit analysis

### Services
- `GeneralSiteReportService` - Uses `withStructuredOutput()` with Zod-to-JSON Schema conversion
- `VendorFitReportService` - Uses `withStructuredOutput()` with Zod-to-JSON Schema conversion

### Structured Output
- All services now use `model.withStructuredOutput(zodToJsonSchema(schema))`
- Automatic JSON schema generation from Zod schemas
- Built-in validation and type safety

## Migration Benefits

1. **Code Reduction**: ~70% reduction in boilerplate code
2. **Reliability**: Built-in error handling and retry mechanisms
3. **Maintainability**: Standard LangChain patterns replace custom abstractions
4. **Performance**: Optimized tool calling and memory management
5. **Developer Experience**: Better debugging and error messages
6. **Modern OpenAI Integration**: Uses OpenAI's Responses API for improved performance and capabilities

## Usage

```typescript
import { generalSiteReportService, vendorFitReportService } from '@/modules/ai';

// Site analysis with structured output
const result = await generalSiteReportService.summarizeSite('https://example.com');
// result.finalResponseParsed contains typed data matching reportOutputSchema

// Vendor fit analysis with structured output
const fitReport = await vendorFitReportService.generateVendorFitReport(partnerInfo, opportunityDesc);
// fitReport.finalResponseParsed contains typed data matching vendorFitOutputSchema

// Custom configuration
import { GeneralSiteReportService } from '@/modules/ai';
const customService = new GeneralSiteReportService({
  model: 'gpt-4.1-mini',
  temperature: 0.2,
  maxIterations: 15
});
```

## API Compatibility

All public APIs maintain the same input/output contracts. No changes required in consuming services.

## Legacy System Removed

The following legacy components have been removed:
- `implementations/OpenAIClient.ts`
- `implementations/ToolRegistry.ts` 
- `interfaces/` directory
- `reportGenerator/` directory
- `tools/` directory (old implementations)

Only the embeddings service continues to use the direct OpenAI client for vector operations.