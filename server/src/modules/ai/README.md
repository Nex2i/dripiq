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

### Tools
All tools have been converted to LangChain `DynamicTool` format:

- `RetrieveFullPageTool` - Downloads and converts HTML to Markdown
- `GetInformationAboutDomainTool` - Semantic search within domain content  
- `ListDomainPagesTool` - Lists available pages for a domain

### Agents
- `SiteAnalysisAgent` - Performs comprehensive website analysis
- `VendorFitAgent` - Analyzes vendor-opportunity fit

### Services
- `GeneralSiteReportService` - Simplified site analysis with structured output
- `VendorFitReportService` - Simplified vendor fit analysis with structured output

## Migration Benefits

1. **Code Reduction**: ~70% reduction in boilerplate code
2. **Reliability**: Built-in error handling and retry mechanisms
3. **Maintainability**: Standard LangChain patterns replace custom abstractions
4. **Performance**: Optimized tool calling and memory management
5. **Developer Experience**: Better debugging and error messages

## Usage

```typescript
import { generalSiteReportService } from '@/modules/ai';

// Site analysis
const result = await generalSiteReportService.summarizeSite('https://example.com');

// Vendor fit analysis  
import { vendorFitReportService } from '@/modules/ai';
const fitReport = await vendorFitReportService.generateVendorFitReport(partnerInfo, opportunityDesc);
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