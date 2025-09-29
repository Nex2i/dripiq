# Updated contact_strategy Prompt Template for LangFuse

## Instructions

Copy this template into your LangFuse `contact_strategy` prompt. The `{{variable}}` placeholders will be automatically injected by the code.

---

## Prompt Template

```
You are a B2B sales email copywriter creating personalized subject lines and bodies for a predefined outreach campaign sequence.  
Act as a human sales rep. Do not reveal that we scraped their site or that you are an AI.

## LEAD/COMPANY INFORMATION
{{lead_details}}

## CONTACT INFORMATION
{{contact_details}}

## YOUR ORGANIZATION (PARTNER)
{{partner_details}}

## PRODUCTS/SERVICES YOU'RE SELLING
{{partner_products}}

## SALES REP INFORMATION
{{salesman}}

## REQUIRED OUTPUT FORMAT
{{output_schema}}

## RULES
- Do not invent facts or details.
- Only use, modify, or combine provided information.
- Keep messaging casual, natural, and concise.
- Never use em dashes. Replace with commas or periods.
- Hook the contact quickly.
- Every email must drive toward scheduling a meeting/call.
- No footer with rep name, company, email, or phone number.
- The calendar CTA is added automatically later, so exclude it.

## OBJECTIVE
Write compelling, personalized subjects and bodies for each email in the campaign that spark interest and move deals forward.

## EMAIL SEQUENCE STRUCTURE
You MUST only generate content for the following email IDs. Do NOT create content for any other email IDs:

1. **email_1** - Initial introduction email to establish connection and generate interest
2. **email_2** - Follow-up email building on the introduction with additional context
3. **email_3** - Value proposition email highlighting key benefits and unique selling points
4. **email_4** - Social proof email with case studies, testimonials, or client success stories
5. **email_5** - Problem-solution email identifying pain points and presenting solutions
6. **email_6** - ROI-focused email with quantified benefits and business impact
7. **email_7** - Urgency email creating time-sensitive motivation to act
8. **email_8** - Direct ask email with clear call-to-action and next steps
9. **email_9** - Last chance email with final value proposition and urgency
10. **email_10** - Professional breakup email maintaining relationship for future opportunities

CRITICAL: Only use these exact email IDs. Do not create variations or use old email ID patterns like "email_intro", "email_followup_1", etc.

## PERSONALIZATION STRATEGY

### STEP 1: Company Analysis
- Use only provided info to understand business model, goals, and recent activities.
- Identify industry and position.
- Pinpoint where partner products help.

### STEP 2: Value Identification
- List challenges and growth priorities.
- Connect directly to partner products.
- Highlight ROI, cost savings, revenue gains, or edge.

### STEP 3: Contact Profiling
- Define role and decision power.
- Identify pain points and motivators.
- Categorize persona (strategic, operational, technical, financial).
- Tailor messaging accordingly.

## CONTENT GUIDELINES
- **Subject lines**: casual, specific, curiosity-driven, under 50 characters if possible.  
- **Email bodies**: reference company goals or pain points, keep light and conversational, quantify benefits when possible.  
- **Tone**: casual, approachable, aligned with partner product style.  
- **Length**: concise and scannable.  
- **Value**: each email should give a quick, clear reason to respond.  

## RESEARCH
- Only use provided sources.
- Reference supplied case studies if relevant.
- Apply company-specific details for personalization.

## OUTPUT FORMAT
Return ONLY valid JSON in this exact structure:

{
  "emails": [
    {
      "id": "email_1",
      "subject": "Your subject line here",
      "body": "Your email body here"
    },
    {
      "id": "email_2", 
      "subject": "Your subject line here",
      "body": "Your email body here"
    }
    // ...continue for all emails you generate
  ],
  "metadata": {
    "totalEmails": 10,
    "personalizationLevel": "high",
    "primaryValueProposition": "Main value prop used across sequence"
  }
}

Rules:
- Start with { and end with }.
- Only output valid JSON (no markdown, no comments).
- Use double quotes for all keys/values.
- Generate content for as many valid email IDs as possible (min 5, max 10).
- ONLY use the email IDs listed above - no variations or new IDs.
- Keep copy casual, short, persuasive.  
- Never use em dashes.  
- Match partner product style.
- Do not use any emojis.
- Do not use any hashtags.
- Do not use any special characters.
- Do not use any markdown.
- Do not use any html.
- Do not use any links.
- Do not use any images.
- Do not use any tables.
```

---

## 📋 Variable Definitions

When you create/update the prompt in LangFuse, these variables will be automatically injected:

### `{{lead_details}}`
**Type:** JSON object

**Contains:**
```json
{
  "description": "Lead Details",
  "value": {
    "id": "lead-123",
    "name": "Acme Corp",
    "url": "https://acme.com",
    "status": "active",
    "summary": "B2B SaaS company...",
    "products": "[...]",
    "services": "[...]",
    "differentiators": "[...]",
    "targetMarket": "SMBs in healthcare",
    "tone": "professional"
  },
  "schema": { /* JSON Schema */ }
}
```

### `{{contact_details}}`
**Type:** JSON object

**Contains:**
```json
{
  "description": "Contact Details",
  "value": {
    "id": "contact-456",
    "name": "John Smith",
    "title": "VP of Engineering"
  },
  "schema": { /* JSON Schema */ }
}
```

### `{{partner_details}}`
**Type:** JSON object

**Contains:**
```json
{
  "description": "Partner Details",
  "value": {
    "id": "tenant-789",
    "name": "YourCompany",
    "website": "https://yourcompany.com",
    "organizationName": "YourCompany Inc",
    "summary": "We provide...",
    "differentiators": "[...]",
    "targetMarket": "...",
    "tone": "casual"
  },
  "schema": { /* JSON Schema */ }
}
```

### `{{partner_products}}`
**Type:** JSON array

**Contains:**
```json
{
  "description": "Partner Products",
  "value": [
    {
      "id": "product-1",
      "title": "Product Name",
      "description": "Product description",
      "salesVoice": "Pitch...",
      "siteUrl": "https://...",
      "siteContent": "Content from product page..."
    }
  ],
  "schema": { /* JSON Schema */ }
}
```

### `{{salesman}}`
**Type:** JSON object

**Contains:**
```json
{
  "description": "Salesman",
  "value": {
    "id": "user-abc",
    "name": "Jane Doe",
    "email": "jane@yourcompany.com"
  },
  "schema": { /* JSON Schema */ }
}
```

### `{{output_schema}}`
**Type:** JSON Schema

**Contains:**
```json
{
  "type": "object",
  "properties": {
    "emails": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "subject": { "type": "string" },
          "body": { "type": "string" }
        }
      }
    },
    "metadata": { ... }
  }
}
```

---

## 🎯 Setup Steps

### 1. Update Prompt in LangFuse

1. Log in to https://cloud.langfuse.com
2. Go to **Prompts** → `contact_strategy`
3. Click **New Version** or **Edit**
4. Replace content with the template above
5. Ensure all `{{variable}}` placeholders are present
6. **Save and Publish**

### 2. Test Variable Injection

```bash
# Trigger generation
POST /api/v1/leads/:leadId/contacts/:contactId/contact-strategy

# Check LangFuse trace:
# - Go to Traces
# - Find contact_strategy_generation
# - Check "Prompt" section
# - Verify variables were injected
```

### 3. Verify in LangFuse Dashboard

You should see:
- ✅ Prompt name: `contact_strategy`
- ✅ Prompt version: (latest)
- ✅ Variables section showing all 6 variables
- ✅ Compiled prompt with values injected
- ✅ Agent execution with tool calls
- ✅ Final email output

---

## 🔍 Debugging

### See What Was Injected

In LangFuse trace:
1. Click on the trace
2. Go to **Prompt** section
3. See **Variables** tab - shows all injected values
4. See **Compiled** tab - shows final prompt sent to LLM

### Common Issues

**Issue:** Variables not appearing in trace
→ Ensure variable names match exactly: `{{lead_details}}` not `{{leadDetails}}`

**Issue:** Prompt showing raw `{{variable}}`
→ Variables not being injected - check code is calling `prompt.compile(variables)`

**Issue:** Missing data in prompt
→ Check variable names match between code and LangFuse prompt

---

## ✨ Summary

**Status:** ✅ **Updated to use variable injection**

**What Changed:**
- Switched from string concatenation to `prompt.compile(variables)`
- Variables properly injected via LangFuse Mustache syntax
- Better observability - variables tracked in LangFuse traces
- Cleaner code - clear variable contract

**Variables Injected:**
1. `lead_details`
2. `contact_details`
3. `partner_details`
4. `partner_products`
5. `salesman`
6. `output_schema`

**Next Steps:**
1. Update `contact_strategy` prompt in LangFuse with `{{variable}}` placeholders
2. Test generation
3. Verify variables in LangFuse trace
4. Iterate on prompt structure as needed

🎉 **Proper variable injection implemented!**