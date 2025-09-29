# LangFuse Setup - Fix "Service Not Available" Error

## 🚨 **Issue Resolution**

You're getting this error because your `.env` file has placeholder values instead of real LangFuse API keys.

```
Error: LangFuse service is not available. Contact strategy generation requires observability services.
```

## ✅ **Solution Steps**

### 1. **Get Your LangFuse API Keys**

1. Go to https://cloud.langfuse.com
2. Sign up or log in to your account
3. Navigate to **Settings** → **API Keys**
4. Create new API keys or copy existing ones

### 2. **Update Your .env File**

Open `/workspace/server/.env` and replace the placeholder values:

```bash
# ❌ Current (placeholders):
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx

# ✅ Update to (your real keys):
LANGFUSE_PUBLIC_KEY=pk-lf-your-actual-public-key-here
LANGFUSE_SECRET_KEY=sk-lf-your-actual-secret-key-here
LANGFUSE_HOST=https://cloud.langfuse.com
LANGFUSE_ENABLED=true
```

### 3. **Test Your Configuration**

Run the debug script to verify your keys work:

```bash
cd /workspace/server
node debug-langfuse.js
```

You should see:
```
✅ All required environment variables are set
✅ LangFuse is enabled
✅ LangFuse client created successfully
✅ Test trace created: [trace-id]
🎉 LangFuse configuration is working correctly!
```

### 4. **Restart Your Server**

After updating your `.env` file, restart your server to pick up the new environment variables.

## 📋 **Required Prompts in LangFuse**

After your API keys are working, create these 4 prompts in your LangFuse dashboard:

| Prompt Name | Type | Variables |
|-------------|------|-----------|
| `summarize_site` | Chat Prompt | `{{domain}}` |
| `vendor_fit` | Chat Prompt | `{{partner_details}}`, `{{opportunity_details}}` |
| `extract_contacts` | Chat Prompt | `{{domain}}`, `{{webdata_contacts}}` |
| `contact_strategy` | Chat Prompt | None |

**Important**: 
- Use **Chat Prompts** (not text prompts)
- Set **Role** to `system` for all prompts
- The system always uses the **latest production version**

## 🔧 **What Was Fixed**

1. **✅ Added LangFuse environment variables** to Fastify validation schema
2. **✅ Removed environment logic** - always uses latest production prompts
3. **✅ Simplified observability system** - removed startup complexity
4. **✅ Created debug utilities** to help troubleshoot configuration
5. **✅ Fixed all compilation errors** and linting issues

## 💡 **Common Issues**

### Issue: "Environment variables not loaded"
**Solution**: Make sure your `.env` file exists in `/workspace/server/` directory

### Issue: "Invalid API keys"  
**Solution**: Double-check your keys in LangFuse dashboard and copy them exactly

### Issue: "Network connectivity"
**Solution**: Verify you can reach https://cloud.langfuse.com from your server

### Issue: "Prompts not found"
**Solution**: Create the 4 required prompts in your LangFuse dashboard

## 🚀 **Next Steps**

1. **Update your .env** with real LangFuse keys
2. **Run the debug script** to verify configuration
3. **Create the 4 prompts** in LangFuse dashboard
4. **Restart your server**
5. **Test your agents** - they should work with full observability!

The error you're experiencing will be resolved once you replace the placeholder API keys with your real LangFuse credentials.