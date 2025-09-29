# LangFuse SmartFilter Integration

## Overview

This document describes the LangChain + LangFuse integration for the `smartFilter` feature in the Site Scrape Service. This implementation provides prompt management, observability, and tracing specifically for the URL filtering logic.

## Architecture

### Directory Structure

```
src/modules/ai/
├── langchain/
│   ├── config/
│   │   ├── langchain.config.ts      # Existing LangChain configuration
│   │   └── langfuse.config.ts       # NEW: LangFuse client initialization
│   ├── services/
│   │   ├── promptManagement.service.ts       # NEW: Prompt fetching & compilation
│   │   └── smartFilterTracing.service.ts    # NEW: Tracing & observability
│   ├── agents/
│   ├── tools/
│   └── utils/
├── siteScrape.service.ts           # UPDATED: Integrated LangFuse
└── __tests__/
    └── smartFilter.integration.test.ts  # NEW: Integration tests
```

## Core Components

### 1. LangFuse Client (`langfuse.config.ts`)

Singleton client that manages connections to LangFuse.

**Features:**
- Lazy initialization
- Environment-based configuration
- Graceful shutdown support

**Environment Variables Required:**
```env
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com  # Optional, defaults to cloud
```

### 2. Prompt Management Service (`promptManagement.service.ts`)

Handles fetching and compiling prompts from LangFuse.

**Key Methods:**
- `fetchPrompt(promptName, options)` - Fetches a prompt by name with optional version/label
- `fetchAndCompilePrompt(promptName, variables, options)` - Fetches and compiles in one step
- `validateVariables(promptName, variables, requiredVars)` - Validates required variables

**Features:**
- Prompt caching (configurable TTL)
- Variable injection with validation
- Version control support
- Environment-based prompt labels

### 3. SmartFilter Tracing Service (`smartFilterTracing.service.ts`)

Provides observability and tracing for smartFilter executions.

**Key Methods:**
- `createTrace(metadata)` - Creates a trace with metadata
- `createGeneration(trace, input, model)` - Creates a generation span for LLM calls
- `endGeneration(generation, output, usage)` - Ends generation with output and token usage
- `recordResult(trace, result)` - Records final execution result
- `recordError(trace, error)` - Records errors in trace

**Trace Metadata:**
- Tenant ID
- User ID (lead ID in worker context)
- Session ID
- Domain
- Site type (lead_site | organization_site)
- URL counts (input, min, max, output)
- Execution time
- Prompt version
- Success/failure status

## Implementation Details

### SmartFilter Integration

The `smartFilterSiteMap` function in `siteScrape.service.ts` now:

1. **Creates a trace** for observability at the start of execution
2. **Fetches the prompt** from LangFuse (cached for 5 minutes)
3. **Compiles the prompt** with dynamic variables (URLs, schema, limits, site type)
4. **Creates a generation span** before the LLM call
5. **Invokes the LLM** with the compiled prompt
6. **Ends the generation** with output
7. **Records the result** including metrics, prompt version, and success status
8. **Handles errors gracefully** by recording them in the trace and falling back to all URLs

### Prompt Name Convention

- **LangFuse Prompt Name:** `smart_filter`
- **Local Prompt (deprecated):** `smart_filter_site`

The local prompt in `prompt.helper.ts` is maintained for backward compatibility but marked as deprecated.

### Variables Required

The `smart_filter` prompt must support these variables:

```typescript
{
  urls: string;              // JSON array of site URLs
  output_schema: string;     // JSON schema for structured output
  min_urls: string;          // Minimum number of URLs to return
  max_urls: string;          // Maximum number of URLs to return
  site_type: string;         // "lead_site" or "organization_site"
}
```

### Error Handling

The implementation follows a graceful fallback strategy:

1. If sitemap is below minimum threshold (45 URLs), skip filtering
2. If LangFuse is unavailable, fall back to all URLs
3. If prompt fetch fails, fall back to all URLs
4. If LLM call fails, fall back to all URLs
5. All errors are logged and traced for debugging

### Business Rules

- **Minimum URLs:** 45
- **Maximum URLs:** 75
- If LLM returns < 45 URLs, use all input URLs
- If LLM returns > 75 URLs, truncate to 75

## Usage

### Basic Usage

```typescript
import { SiteScrapeService } from '@/modules/ai/siteScrape.service';

const siteMap = [
  { url: 'https://example.com/page1', title: 'Page 1' },
  { url: 'https://example.com/page2', title: 'Page 2' },
  // ... more URLs
];

const filteredUrls = await SiteScrapeService.smartFilterSiteMap(
  siteMap,
  'lead_site'
);
```

### With Metadata (Recommended)

```typescript
const filteredUrls = await SiteScrapeService.smartFilterSiteMap(
  siteMap,
  'organization_site',
  {
    tenantId: 'tenant-123',
    userId: 'user-456',
    domain: 'example.com',
    sessionId: 'session-789',
  }
);
```

## Setting Up LangFuse

### 1. Create Prompt in LangFuse

1. Log in to [LangFuse Cloud](https://cloud.langfuse.com) or your self-hosted instance
2. Navigate to **Prompts**
3. Create a new prompt named `smart_filter`
4. Use the template from `/workspace/server/src/prompts/smart_filter_site.prompt.ts`
5. Define the following variables:
   - `{{urls}}`
   - `{{output_schema}}`
   - `{{min_urls}}`
   - `{{max_urls}}`
   - `{{site_type}}`
6. Publish the prompt

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# LangFuse Configuration
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com
```

### 3. Create API Keys

1. In LangFuse, go to **Settings** → **API Keys**
2. Create a new API key
3. Copy the public and secret keys
4. Add them to your environment

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run smartFilter tests only
npm test -- smartFilter.integration.test.ts
```

### Test Coverage

The integration tests cover:
- ✅ Skipping filter when below minimum threshold
- ✅ Creating trace with correct metadata
- ✅ Fetching prompt from LangFuse with caching
- ✅ Compiling prompt with correct variables
- ✅ Creating generation span for LLM call
- ✅ Recording successful result with metrics
- ✅ Handling errors and recording in trace
- ✅ Handling missing LangFuse credentials gracefully
- ✅ Ending generation span with output
- ✅ Handling both lead_site and organization_site types
- ✅ Tracking execution time
- ✅ Including prompt version in trace
- ✅ Marking usedFallback flag appropriately

## Monitoring & Observability

### Key Metrics in LangFuse

- **Execution Time:** Time taken for filtering
- **Token Usage:** Prompt and completion tokens (if available from LLM)
- **Prompt Version:** Version of prompt used
- **Success Rate:** Percentage of successful vs. fallback executions
- **URL Counts:** Input vs. output URL counts
- **Error Rate:** Frequency and types of errors

### Trace Attributes

Each trace includes:
- Trace ID (automatically generated)
- Tenant ID
- User/Lead ID
- Domain being processed
- Site type
- Input/output URL counts
- Execution time
- Prompt version
- Success/failure status
- Error details (if applicable)

## Performance Considerations

- **Prompt Caching:** 5-minute TTL reduces LangFuse API calls
- **Async Operations:** All LangFuse calls are non-blocking
- **Fallback Strategy:** Ensures system continues working even if LangFuse is down
- **Token Efficiency:** Uses structured output for consistent parsing

## Migration Notes

### Breaking Changes

- `smartFilterSiteMap` now accepts an optional third parameter for metadata
- Function signature changed from:
  ```typescript
  (siteMap: SearchResultWeb[], siteType: SiteType) => Promise<string[]>
  ```
  to:
  ```typescript
  (siteMap: SearchResultWeb[], siteType: SiteType, options?: SmartFilterOptions) => Promise<string[]>
  ```

### Backward Compatibility

- The optional `options` parameter maintains backward compatibility
- Existing calls without metadata will continue to work
- Local prompt remains available but is deprecated

## Troubleshooting

### Common Issues

**Issue:** "LangFuse credentials not configured"
- **Solution:** Ensure `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set

**Issue:** "Prompt 'smart_filter' not found"
- **Solution:** Create the prompt in LangFuse with the exact name `smart_filter`

**Issue:** All executions using fallback
- **Solution:** Check LangFuse connectivity and prompt configuration

**Issue:** Missing variables in prompt
- **Solution:** Ensure all required variables are defined in the LangFuse prompt

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## Future Enhancements

Potential improvements (not in current scope):

- [ ] Extend LangFuse integration to other AI features
- [ ] Add custom metrics and dashboards
- [ ] Implement A/B testing for different prompts
- [ ] Add automatic prompt version rollback on errors
- [ ] Integrate user feedback into traces

## References

- [LangFuse Documentation](https://langfuse.com/docs)
- [LangFuse Prompt Management](https://langfuse.com/docs/prompt-management/get-started)
- [LangChain Integration](https://langfuse.com/docs/integrations/langchain)
- [Tracing Guide](https://langfuse.com/docs/tracing)

## Support

For issues or questions:
1. Check this documentation
2. Review LangFuse traces for errors
3. Check application logs
4. Contact the development team