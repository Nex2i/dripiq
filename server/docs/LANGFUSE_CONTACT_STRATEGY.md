# LangFuse Contact Strategy Integration

## Overview

The `ContactStrategyAgent` now uses **LangFuse** for prompt management and observability. This integration provides comprehensive tracing for email campaign generation, including agent execution, tool calls, and performance metrics.

## Quick Setup

### 1. Create Prompt in LangFuse

1. **Navigate to Prompts** in LangFuse dashboard
2. **Click "+ New Prompt"**
3. **Configure:**
   - Name: `contact_strategy` (exact name!)
   - Type: Text
   - Label: `production` (or `local` for development)

4. **Copy the prompt content** from:
   `/workspace/server/src/prompts/contact_strategy.prompt.ts`

5. **Paste into LangFuse** and **Publish**

### 2. Environment Variables

Ensure these are set in your `.env`:
```env
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com
```

### 3. Test It

Trigger contact strategy generation via:
- API endpoint: `POST /api/v1/leads/:leadId/contacts/:contactId/contact-strategy`
- Worker: Campaign creation worker
- UI: Generate strategy button in contacts tab

## What Changed

### Before (Local Prompt)
```typescript
// Prompt was hardcoded in codebase
systemPrompt = promptHelper.getPromptAndInject('contact_strategy', {});
const result = await this.agent.invoke({ system_prompt: systemPrompt, ... });
```

### After (LangFuse)
```typescript
// 1. Create trace
const trace = contactStrategyTracingService.createTrace(metadata);

// 2. Fetch prompt from LangFuse
const prompt = await promptManagementService.fetchPrompt('contact_strategy');

// 3. Compile prompt
const systemPrompt = prompt.compile({});

// 4. Create generation span
const generation = contactStrategyTracingService.createGeneration(trace, systemPrompt, model, inputData);

// 5. Invoke agent
const result = await this.agent.invoke({ system_prompt: systemPrompt, ... });

// 6. End generation span
contactStrategyTracingService.endGeneration(generation, output);

// 7. Record tool calls
result.intermediateSteps.forEach(step => {
  contactStrategyTracingService.recordToolCall(trace, toolName, input, output);
});

// 8. Record result
contactStrategyTracingService.recordResult(trace, result);
```

## Observability Features

### Trace Metadata
Every contact strategy generation includes:
- **Tenant ID** - Organization context
- **Lead ID** - Which lead/company
- **Contact ID** - Which contact person
- **User ID** - Who triggered the generation
- **Lead Name** - Company name
- **Contact Name** - Person name
- **Partner Name** - Your organization

### Performance Metrics
- **Execution Time** - Total time to generate strategy
- **Total Iterations** - Agent reasoning steps
- **Emails Generated** - Number of emails in sequence (1-10)
- **Function Calls** - Tool/function invocations
- **Prompt Version** - Which prompt version was used
- **Token Usage** - Prompt/completion tokens (if available)

### Tool Call Tracking
Automatically tracks usage of:
- `ListDomainPagesTool` - List pages on a domain
- `GetInformationAboutDomainTool` - Get domain info
- `RetrieveFullPageTool` - Retrieve full page content

### Error Tracking
Captures and logs:
- Agent execution failures
- Prompt fetching errors
- JSON parsing errors
- Mapping errors (email content → campaign plan)
- Database persistence errors

## Architecture

### Files Created/Modified

**Created:**
```
server/src/modules/ai/langchain/services/
└── contactStrategyTracing.service.ts    [NEW]
```

**Modified:**
```
server/src/modules/ai/langchain/agents/
└── ContactStrategyAgent.ts              [MODIFIED]
```

### Service Structure

#### ContactStrategyTracingService

**Methods:**
- `createTrace(metadata)` - Creates trace with context
- `createGeneration(trace, prompt, model, input)` - Creates generation span
- `endGeneration(generation, output, usage?)` - Ends generation with output
- `recordToolCall(trace, name, input, output)` - Records tool usage
- `recordResult(trace, result)` - Records final result
- `recordError(trace, error, stage?)` - Records errors
- `recordValidationError(trace, stage, error)` - Records validation errors

## Usage Example

### Trigger Contact Strategy Generation

```typescript
// Via API
const result = await generateContactStrategy({
  leadId: 'lead-123',
  contactId: 'contact-456',
  tenantId: 'tenant-789',
  userId: 'user-abc',
});

// Result includes:
// - finalResponse: string
// - finalResponseParsed: CampaignPlanOutput with 10 emails
// - totalIterations: number
// - functionCalls: array of tool calls
```

### View Traces in LangFuse

1. **Go to Traces** in LangFuse dashboard
2. **Filter by:** `contact_strategy_generation`
3. **Click on a trace** to see:
   - Input data (lead, contact, partner info)
   - System prompt used
   - Agent reasoning steps
   - Tool calls made
   - Final email content generated
   - Execution time and token usage
   - Any errors encountered

## Prompt Structure

The `contact_strategy` prompt generates a **10-email outreach sequence**:

1. **email_1** - Initial introduction
2. **email_2** - Follow-up building context
3. **email_3** - Value proposition
4. **email_4** - Social proof
5. **email_5** - Problem-solution
6. **email_6** - ROI-focused
7. **email_7** - Urgency
8. **email_8** - Direct ask
9. **email_9** - Last chance
10. **email_10** - Professional breakup

**Output Schema:**
```json
{
  "emails": [
    {
      "id": "email_1",
      "subject": "Subject line",
      "body": "Email body"
    }
    // ... more emails
  ],
  "metadata": {
    "totalEmails": 10,
    "personalizationLevel": "high",
    "primaryValueProposition": "Main value prop"
  }
}
```

## Monitoring & Analytics

### Key Metrics in LangFuse

**Success Metrics:**
- Success rate (% successful generations)
- Average execution time
- Average emails generated per sequence
- Tool usage frequency

**Performance Metrics:**
- P50/P95/P99 execution times
- Token usage trends
- Agent iteration counts
- Error rates by stage

**Quality Metrics:**
- Email count distribution
- Personalization levels
- Tool call patterns
- Prompt version performance

### Dashboard Views

**Recommended Views:**
1. **Success Rate Over Time** - Track generation success %
2. **Execution Time Trends** - Monitor performance
3. **Error Analysis** - Group errors by stage/type
4. **Prompt Version Comparison** - A/B test prompts
5. **Tool Usage Patterns** - Understand agent behavior

## Error Handling

### Error Types

**Prompt Fetching Errors:**
- LangFuse unavailable
- Prompt not found
- Invalid prompt format

**Agent Execution Errors:**
- Agent timeout
- No response generated
- Invalid tool calls

**Parsing Errors:**
- Invalid JSON output
- Schema validation failures
- Missing required fields

**Mapping Errors:**
- Campaign plan mapping failures
- Invalid email structure

**Database Errors:**
- Persistence failures
- Duplicate campaign issues

### Error Recovery

All errors are:
1. **Logged** to application logs
2. **Traced** in LangFuse with context
3. **Propagated** to caller with clear messages
4. **Categorized** by stage for debugging

## Best Practices

### 1. Monitor Regularly
- Check LangFuse daily for errors
- Review execution time trends
- Analyze failed generations

### 2. Iterate on Prompts
- Use LangFuse analytics to identify issues
- A/B test prompt variations
- Track performance by version

### 3. Optimize Tool Usage
- Review tool call patterns
- Add/remove tools based on usage
- Optimize tool implementations

### 4. Handle Failures Gracefully
- Set up alerts for high error rates
- Monitor success rates
- Review error traces regularly

## Troubleshooting

### Issue: "Prompt 'contact_strategy' not found"

**Solution:**
1. Create prompt in LangFuse
2. Ensure name is exactly `contact_strategy`
3. Publish the prompt (not just save as draft)

### Issue: High execution times

**Solution:**
1. Check agent iteration counts in traces
2. Review tool call patterns
3. Consider adjusting `maxIterations` in config
4. Optimize tool implementations

### Issue: Low success rates

**Solution:**
1. Review error traces in LangFuse
2. Check prompt clarity and instructions
3. Verify input data quality
4. Test with different leads/contacts

### Issue: Invalid JSON outputs

**Solution:**
1. Review generated outputs in traces
2. Strengthen JSON instructions in prompt
3. Add validation examples to prompt
4. Consider using structured output mode

## Configuration

### Agent Configuration

Located in `langchain.config.ts`:
```typescript
export const defaultLangChainConfig: LangChainConfig = {
  model: 'gpt-5-mini',
  maxIterations: 20,
  timeout: 60000, // 60 seconds
};
```

### Prompt Caching

Default: 5 minutes (300 seconds)

To adjust:
```typescript
const prompt = await promptManagementService.fetchPrompt('contact_strategy', {
  cacheTtlSeconds: 600, // 10 minutes
});
```

## Testing

### Manual Testing

1. **Create a test lead** with good data
2. **Add a contact** to the lead
3. **Trigger strategy generation:**
   ```bash
   curl -X POST \
     http://localhost:3000/api/v1/leads/{leadId}/contacts/{contactId}/contact-strategy \
     -H "Authorization: Bearer {token}"
   ```
4. **Check LangFuse** for the trace
5. **Verify output** in database

### Testing Checklist

- [ ] Prompt created in LangFuse
- [ ] Environment variables configured
- [ ] Agent generates 10 emails
- [ ] Trace appears in LangFuse
- [ ] Tool calls recorded correctly
- [ ] Execution time reasonable (<60s)
- [ ] Errors logged properly
- [ ] Campaign persisted to database

## Production Readiness

### Before Deployment

- [ ] LangFuse account configured
- [ ] `contact_strategy` prompt created and published
- [ ] Environment variables set in production
- [ ] Test with sample data
- [ ] Monitor first few generations
- [ ] Set up alerts for failures
- [ ] Document team workflows

### Deployment Steps

1. **Deploy code** with LangFuse integration
2. **Create prompt** in production LangFuse
3. **Test with safe lead/contact**
4. **Monitor traces** closely
5. **Validate output quality**
6. **Enable for all users**

## Future Enhancements

Possible improvements (not in current scope):

- [ ] Add A/B testing for different prompt strategies
- [ ] Track user satisfaction with generated content
- [ ] Implement feedback loop from edits
- [ ] Add custom metrics for email quality
- [ ] Build custom LangFuse dashboards
- [ ] Integrate user feedback into traces
- [ ] Add automatic prompt optimization

## Support

- **Setup Guide:** `/workspace/server/docs/LANGFUSE_SETUP.md`
- **SmartFilter Integration:** `/workspace/server/docs/langfuse-smartfilter-integration.md`
- **LangFuse Docs:** https://langfuse.com/docs
- **Tracing Guide:** https://langfuse.com/docs/tracing

---

**Status:** ✅ **Implemented and Ready for Testing**

**Next Steps:**
1. Create `contact_strategy` prompt in LangFuse
2. Test with sample lead/contact
3. Monitor traces
4. Iterate on prompt as needed