# Getting Started with LangFuse SmartFilter Integration

## 🎯 What Was Implemented

The `smartFilter` feature in the Site Scrape Service now uses **LangFuse** for:
- **Prompt Management:** Prompts are stored and managed in LangFuse, not in code
- **Observability:** Every execution is traced with detailed metrics
- **Version Control:** Prompts can be versioned and iterated without code changes

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies (Already Done ✅)

The `langfuse` npm package has already been installed:
```bash
cd /workspace/server
npm list langfuse  # Verify installation
```

### Step 2: Set Up LangFuse Account

1. **Sign up:** Go to https://cloud.langfuse.com
2. **Create project:** Create a new project or use existing
3. **Get API keys:** 
   - Go to Settings → API Keys
   - Click "Create new API key"
   - Copy both keys (pk-lf-... and sk-lf-...)

### Step 3: Configure Environment

Add to your `.env` file:
```env
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key-here
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key-here
LANGFUSE_HOST=https://cloud.langfuse.com
```

### Step 4: Create the Prompt in LangFuse

1. **Navigate to Prompts** in LangFuse dashboard
2. **Click "+ New Prompt"**
3. **Fill in:**
   - Name: `smart_filter` (exact name!)
   - Type: Text
   - Label: `production` (or `local` for development)
4. **Copy the prompt template** from:
   `/workspace/server/src/prompts/smart_filter_site.prompt.ts`
5. **Paste into LangFuse**
6. **Save and Publish**

### Step 5: Test It

```bash
cd /workspace/server

# Run tests
npm test -- smartFilter.integration.test.ts

# Start server
npm run dev

# Process a lead and check LangFuse for traces
```

## 📁 What Changed

### New Files Created

```
server/src/modules/ai/langchain/
├── config/
│   └── langfuse.config.ts                    # LangFuse client
├── services/
│   ├── promptManagement.service.ts           # Prompt fetching
│   └── smartFilterTracing.service.ts         # Tracing & observability

server/src/modules/ai/__tests__/
└── smartFilter.integration.test.ts           # Integration tests (13 tests, all passing)

server/docs/
├── langfuse-smartfilter-integration.md       # Technical documentation
└── LANGFUSE_SETUP.md                         # Setup guide
```

### Files Modified

```
server/src/config/index.ts                    # Added LangFuse env vars
server/src/modules/ai/siteScrape.service.ts   # Integrated LangFuse
server/src/prompts/prompt.helper.ts           # Marked old prompt as deprecated
server/src/workers/lead-initial-processing/
  lead-initial-processing.worker.ts           # Added metadata to smartFilter call
```

## 🔍 How It Works

### Before (Local Prompt)
```typescript
// Prompt was hardcoded in the codebase
const prompt = promptHelper.getPromptAndInject('smart_filter_site', variables);
const response = await llm.invoke(prompt);
```

### After (LangFuse)
```typescript
// 1. Create trace for observability
const trace = smartFilterTracingService.createTrace(metadata);

// 2. Fetch prompt from LangFuse (cached 5 min)
const prompt = await promptManagementService.fetchPrompt('smart_filter');

// 3. Compile with variables
const compiledPrompt = prompt.compile(variables);

// 4. Create generation span
const generation = smartFilterTracingService.createGeneration(trace, compiledPrompt, model);

// 5. Invoke LLM
const response = await llm.invoke(compiledPrompt);

// 6. End generation span
smartFilterTracingService.endGeneration(generation, response);

// 7. Record result
smartFilterTracingService.recordResult(trace, result);
```

## 📊 What You Get

### In LangFuse Dashboard

**Traces:**
- Every smartFilter execution
- Execution time
- Input/output URLs
- Tenant/user/domain context
- Success/failure status
- Error details (if any)

**Prompts:**
- Version history
- Usage analytics
- Performance metrics
- A/B testing capability

**Metrics:**
- Success rate
- Execution time trends
- Token usage
- Error patterns

## 🧪 Testing

All tests pass ✅

```bash
cd /workspace/server
npm test -- smartFilter.integration.test.ts

# Output:
# PASS  src/modules/ai/__tests__/smartFilter.integration.test.ts
#   SmartFilter Integration with LangFuse
#     smartFilterSiteMap
#       ✓ should skip filtering when sitemap is below minimum threshold
#       ✓ should create trace with correct metadata
#       ✓ should fetch prompt from LangFuse with caching
#       ✓ should compile prompt with correct variables
#       ✓ should create generation span for LLM call
#       ✓ should record successful result with metrics
#       ✓ should handle errors and record them in trace
#       ✓ should handle missing LangFuse credentials gracefully
#       ✓ should end generation span with output
#       ✓ should handle both lead_site and organization_site types
#     Observability and Tracing
#       ✓ should track execution time
#       ✓ should include prompt version in trace
#       ✓ should mark usedFallback flag when returning all URLs
#
# Test Suites: 1 passed, 1 total
# Tests:       13 passed, 13 total
```

## 🔧 Build & Deploy

```bash
cd /workspace/server

# Lint (already passing ✅)
npm run lint

# Build (already passing ✅)
npm run build

# Run tests
npm test

# Start server
npm run dev

# Deploy to production
npm run prod:server
```

## 📖 Documentation

- **Setup Guide:** `/workspace/server/docs/LANGFUSE_SETUP.md`
- **Technical Docs:** `/workspace/server/docs/langfuse-smartfilter-integration.md`
- **Implementation Summary:** `/workspace/IMPLEMENTATION_SUMMARY.md`

## ⚠️ Important Notes

### Breaking Changes
**None!** The integration is backward compatible:
- Existing code works without modification
- Optional metadata parameter for enhanced tracing
- Graceful fallback if LangFuse unavailable

### Environment Variables
**Required:**
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

**Optional:**
- `LANGFUSE_HOST` (defaults to https://cloud.langfuse.com)

### Prompt Name
**Must be exactly:** `smart_filter` (case-sensitive, no spaces)

## 🎓 Key Concepts

### Prompt Management
- Prompts are managed in LangFuse UI
- No code changes needed to update prompts
- Version control built-in
- Rollback support

### Tracing
- Every execution automatically traced
- Rich context and metadata
- Error tracking
- Performance monitoring

### Fallback Strategy
If LangFuse fails:
1. Error is logged
2. Trace is recorded with error
3. System falls back to returning all URLs
4. Application continues working

## 🐛 Troubleshooting

### "LangFuse credentials not configured"
→ Set environment variables in `.env`

### "Prompt 'smart_filter' not found"
→ Create prompt in LangFuse with exact name `smart_filter`

### Tests failing
→ Ensure all mocks are properly configured

### Build errors
→ Run `npm run lint:fix` and rebuild

## 👥 Team Workflow

### For Developers
1. Code works as before
2. Add metadata for better tracing:
   ```typescript
   await SiteScrapeService.smartFilterSiteMap(siteMap, 'lead_site', {
     tenantId: 'tenant-123',
     userId: 'user-456',
     domain: 'example.com',
   });
   ```

### For Product/Data Teams
1. Access LangFuse dashboard
2. View traces and analytics
3. Iterate on prompts without code changes
4. A/B test different prompt versions

### For DevOps
1. Set up environment variables
2. Monitor LangFuse connectivity
3. Set up alerts for failures
4. Monitor performance metrics

## ✅ Checklist for Going Live

- [ ] LangFuse account created
- [ ] Project set up in LangFuse
- [ ] API keys generated
- [ ] Environment variables configured
- [ ] `smart_filter` prompt created and published
- [ ] All tests passing locally
- [ ] Build successful
- [ ] Tested in staging environment
- [ ] Monitoring dashboard checked
- [ ] Team trained on LangFuse
- [ ] Alerts configured
- [ ] Documentation reviewed

## 🚦 Status

- **Dependencies:** ✅ Installed
- **Code:** ✅ Implemented
- **Tests:** ✅ 13/13 passing
- **Linting:** ✅ 0 errors, 0 warnings
- **Build:** ✅ Compiles successfully
- **Documentation:** ✅ Complete

**Ready for:** LangFuse setup and testing

## 📞 Support

- **Documentation:** See `/workspace/server/docs/`
- **Tests:** See `/workspace/server/src/modules/ai/__tests__/smartFilter.integration.test.ts`
- **LangFuse Support:** https://discord.gg/7NXusRtqYU
- **LangFuse Docs:** https://langfuse.com/docs

## 🎉 Next Steps

1. ⭐ **Set up LangFuse account** (5 minutes)
2. 🔑 **Add API keys to .env** (1 minute)
3. 📝 **Create smart_filter prompt** (2 minutes)
4. ✅ **Test it** (2 minutes)
5. 🚀 **Deploy** (when ready)

---

**Questions?** Check the documentation or reach out to the team!