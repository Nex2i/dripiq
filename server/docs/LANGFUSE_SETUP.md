# LangFuse Setup Guide for SmartFilter

## Quick Start

This guide will help you set up LangFuse integration for the `smartFilter` feature in 5 minutes.

## Prerequisites

- LangFuse account (sign up at [cloud.langfuse.com](https://cloud.langfuse.com) or self-host)
- Access to your environment configuration

## Step 1: Create LangFuse Account & API Keys

1. **Sign up** at https://cloud.langfuse.com (or use your self-hosted instance)
2. **Create a new project** (or use existing)
3. Navigate to **Settings** → **API Keys**
4. Click **Create new API key**
5. Copy the **Public Key** (starts with `pk-lf-`)
6. Copy the **Secret Key** (starts with `sk-lf-`)

## Step 2: Configure Environment Variables

Add these to your `.env` file:

```env
# LangFuse Configuration
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key-here
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key-here
LANGFUSE_HOST=https://cloud.langfuse.com
```

⚠️ **Important:** Never commit these keys to version control!

## Step 3: Create the SmartFilter Prompt

### 3.1 Navigate to Prompts

1. In LangFuse dashboard, go to **Prompts**
2. Click **+ New Prompt**

### 3.2 Configure Prompt

- **Name:** `smart_filter` (exact name required)
- **Type:** Text
- **Labels:** `production` (or `local` for local development)

### 3.3 Prompt Content

Copy the content from `/workspace/server/src/prompts/smart_filter_site.prompt.ts`:

```
You are given a list of URLs from a company's website and the site type: {{site_type}}.

Your goal, based on the site type, is to select URLs most likely to contain relevant information:

- If the site type is "organization_site", prioritize URLs most likely containing **product and service information** about the company. Prioritize URLs that:
  - Include segments such as "/products", "/services", "/solutions", "/offerings", "/portfolio", "/capabilities".
  - Clearly reference specific products or services provided by the organization.
  - ignore routes like robots.txt, sitemap.xml, and privacy policies.
  - Match patterns indicating detailed descriptions or listings of products and services, such as "/products/**", "/services/**", "/solutions/**", or similar.

- If the site type is "lead_site", prioritize URLs most likely containing **contact information** about the company, its team, departments, locations, or individual members. Prioritize URLs that:
  - Include segments such as "/contact", "/team", "/staff", "/directory", "/people", "/employees", "/members", "/offices", "/locations".
  - Reference individual or departmental contact details (names, roles, titles, profiles, departments, locations).
  - Match patterns indicating lists or profiles of people, such as "/team/**", "/staff/**", "/directory/**", "/people/**", "/employees/**", or similar.
  - Additionally, for professional services (law firms, insurance, consulting, accounting, real estate, healthcare), include URLs containing industry-specific terms like: "/attorney/", "/lawyer/", "/agent/", "/advisor/", "/broker/", "/provider/", "/doctor/", "/realtor/", "/counselor/", and their plural forms.

If additional URLs are needed to reach {{min_urls}}, include URLs likely containing core business information (e.g., about, overview, history).

Do not exceed {{max_urls}} URLs but try to reach close to this maximum if relevant URLs are available.

Given these URLs:
{{urls}}

Return at least {{min_urls}} URLs, but include as many relevant URLs as possible, up to {{max_urls}}.

Output only a valid JSON array of strings, prioritizing the relevant pages first according to the site type.

**Output Schema:**
{{output_schema}}
```

### 3.4 Define Variables

Add these variables (they will be injected dynamically):

- `urls` - The list of URLs to filter
- `output_schema` - JSON schema for structured output
- `min_urls` - Minimum number of URLs (45)
- `max_urls` - Maximum number of URLs (75)
- `site_type` - Either "lead_site" or "organization_site"

### 3.5 Save & Publish

1. Click **Save as Draft**
2. Review the prompt
3. Click **Publish** to make it active

## Step 4: Verify Installation

### 4.1 Check Dependencies

```bash
cd /workspace/server
npm list langfuse
```

You should see: `langfuse@x.x.x`

### 4.2 Run Tests

```bash
npm test -- smartFilter.integration.test.ts
```

All tests should pass ✅

### 4.3 Check Configuration

```bash
# Verify environment variables are loaded
node -e "require('dotenv').config(); console.log('LANGFUSE_PUBLIC_KEY:', process.env.LANGFUSE_PUBLIC_KEY ? '✅ Set' : '❌ Missing')"
```

## Step 5: Monitor in LangFuse

### 5.1 Run the Application

```bash
npm run dev
```

### 5.2 Trigger a SmartFilter Execution

The smartFilter runs automatically when processing leads. To trigger it:

1. Add a new lead via the API or UI
2. Wait for the lead initial processing job to run
3. Check LangFuse dashboard for traces

### 5.3 View Traces

1. Go to **Traces** in LangFuse dashboard
2. Look for traces named `smart_filter_site_map`
3. Click on a trace to see:
   - Execution time
   - Input/output
   - Metadata (tenant, domain, etc.)
   - Any errors

### 5.4 Analyze Prompts

1. Go to **Prompts** → **smart_filter**
2. Click **Analytics** tab
3. View:
   - Usage statistics
   - Performance metrics
   - Version comparison

## Troubleshooting

### Issue: "LangFuse credentials not configured"

**Cause:** Environment variables not set or not loaded

**Solution:**
```bash
# Check if variables are set
echo $LANGFUSE_PUBLIC_KEY
echo $LANGFUSE_SECRET_KEY

# If empty, add them to .env file and restart server
```

### Issue: "Prompt 'smart_filter' not found"

**Cause:** Prompt not created in LangFuse or wrong name

**Solution:**
1. Check prompt name is exactly `smart_filter` (no spaces, case-sensitive)
2. Ensure prompt is published (not draft)
3. Verify you're using the correct project in LangFuse

### Issue: All executions show "usedFallback: true"

**Cause:** SmartFilter is failing and falling back to default behavior

**Solution:**
1. Check application logs for errors
2. Verify LangFuse connectivity
3. Check prompt has all required variables
4. Ensure OpenAI API key is configured

### Issue: "Cannot connect to LangFuse"

**Cause:** Network issue or wrong host

**Solution:**
1. Verify `LANGFUSE_HOST` is correct
2. Check network connectivity: `curl https://cloud.langfuse.com`
3. For self-hosted, ensure host is accessible

## Advanced Configuration

### Using Different Prompts for Environments

Create multiple prompt labels in LangFuse:

```typescript
// In promptManagement.service.ts
const label = process.env.NODE_ENV === 'production' ? 'production' : 'local';

await promptManagementService.fetchPrompt('smart_filter', {
  label,
  cacheTtlSeconds: 300,
});
```

### Adjusting Cache TTL

Modify cache duration in `siteScrape.service.ts`:

```typescript
const prompt = await promptManagementService.fetchPrompt('smart_filter', {
  cacheTtlSeconds: 600, // 10 minutes
});
```

### Custom Trace Metadata

Add more metadata when calling smartFilter:

```typescript
await SiteScrapeService.smartFilterSiteMap(siteMap, 'lead_site', {
  tenantId: 'tenant-123',
  userId: 'user-456',
  domain: 'example.com',
  sessionId: 'session-789',
});
```

## Production Checklist

Before deploying to production:

- [ ] LangFuse API keys configured in production environment
- [ ] Prompt created and published in LangFuse
- [ ] Prompt tested with sample data
- [ ] All tests passing
- [ ] Error handling verified
- [ ] Monitoring dashboard set up in LangFuse
- [ ] Alerts configured for failures
- [ ] Documentation updated
- [ ] Team trained on LangFuse dashboard

## Support Resources

- **LangFuse Documentation:** https://langfuse.com/docs
- **Integration Documentation:** `/workspace/server/docs/langfuse-smartfilter-integration.md`
- **Test Suite:** `/workspace/server/src/modules/ai/__tests__/smartFilter.integration.test.ts`
- **LangFuse Community:** https://discord.gg/7NXusRtqYU

## Next Steps

After setup is complete:

1. **Monitor Performance:** Check execution times and success rates in LangFuse
2. **Iterate on Prompt:** Use LangFuse's A/B testing to improve results
3. **Scale:** Consider extending LangFuse to other AI features
4. **Optimize:** Adjust cache TTL and other parameters based on usage

---

**Questions?** Check the main documentation or contact the development team.