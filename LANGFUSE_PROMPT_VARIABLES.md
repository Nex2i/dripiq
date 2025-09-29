# LangFuse Prompt with Variable Injection ✅

## Overview

Updated the `ContactStrategyAgent` to use **variable injection** in the LangFuse prompt instead of concatenating context. This follows the LangFuse best practice of using `{{variable}}` syntax in prompts.

---

## 🔄 What Changed

### Before (String Concatenation)
```typescript
// Fetch prompt
const langfusePrompt = await fetchPrompt('contact_strategy');
const systemPromptText = langfusePrompt.getLangchainPrompt();

// Manually format and concatenate context
const fullSystemPrompt = `${systemPromptText}

# Lead Details
${JSON.stringify(leadDetails.value, null, 2)}

# Contact Details
${JSON.stringify(contactDetails.value, null, 2)}
...`;

// Use concatenated string
const prompt = ChatPromptTemplate.fromMessages([
  ['system', fullSystemPrompt],
]);
```

**Problems:**
- ❌ Manual string concatenation
- ❌ No variable tracking in LangFuse
- ❌ Prompt changes require code changes
- ❌ Can't see which variables were used in traces

### After (Variable Injection)
```typescript
// Fetch prompt with {{variables}}
const langfusePrompt = await fetchPrompt('contact_strategy');

// Prepare variables as key-value pairs
const variables = {
  lead_details: JSON.stringify({
    description: leadDetails.description,
    value: leadDetails.value,
    schema: leadDetails.schema,
  }, null, 2),
  contact_details: JSON.stringify(...),
  partner_details: JSON.stringify(...),
  partner_products: JSON.stringify(...),
  salesman: JSON.stringify(...),
  output_schema: JSON.stringify(outputSchema, null, 2),
};

// Compile prompt with variable injection
const compiledPrompt = langfusePrompt.compile(variables);

// Use compiled result
const prompt = ChatPromptTemplate.fromMessages([
  ['system', compiledPrompt],
  ['placeholder', '{agent_scratchpad}'],
]);
```

**Benefits:**
- ✅ **Clean variable injection** via `compile()`
- ✅ **LangFuse tracks variables** - See what was injected in each trace
- ✅ **Prompt flexibility** - Change variable placement in LangFuse UI
- ✅ **Better observability** - Variables visible in LangFuse dashboard
- ✅ **True separation** - Prompt structure in LangFuse, data in code

---

## 📝 LangFuse Prompt Structure

The `contact_strategy` prompt in LangFuse should now include these **variable placeholders**:

```
You are a B2B sales email copywriter creating personalized subject lines and bodies for a predefined outreach campaign sequence.

{{lead_details}}

{{contact_details}}

{{partner_details}}

{{partner_products}}

{{salesman}}

{{output_schema}}

[Rest of the prompt instructions...]
```

### Required Variables

The prompt **must** include these variables (using Mustache syntax `{{variable}}`):

1. `{{lead_details}}` - Lead/company information
2. `{{contact_details}}` - Contact person information
3. `{{partner_details}}` - Your organization information
4. `{{partner_products}}` - Products/services you're selling
5. `{{salesman}}` - Sales rep information
6. `{{output_schema}}` - JSON schema for structured output

---

## 🎯 How It Works

### 1. Data Gathering
```typescript
const leadDetails = await this.getLeadDetails(tenantId, leadId);
const contactDetails = await this.getContactDetails(contactId);
// ... gather all data
```

### 2. Variable Preparation
```typescript
const variables = {
  lead_details: JSON.stringify({
    description: leadDetails.description,
    value: leadDetails.value,
    schema: leadDetails.schema,
  }, null, 2),
  // ... all other variables
};
```

### 3. Prompt Compilation
```typescript
// LangFuse replaces {{lead_details}} with the actual JSON
const compiledPrompt = langfusePrompt.compile(variables);
```

### 4. LangChain Integration
```typescript
// Use compiled prompt in LangChain template
const prompt = ChatPromptTemplate.fromMessages([
  ['system', compiledPrompt],
  ['placeholder', '{agent_scratchpad}'],
]);

// Build agent
const agent = createToolCallingAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools });

// Invoke
await executor.invoke({}, { callbacks: [langfuseHandler] });
```

---

## ✅ Benefits

### For Prompt Engineering
- ✅ **See variables in LangFuse** - Know exactly what data was injected
- ✅ **Change variable placement** - Reorganize in LangFuse UI without code changes
- ✅ **Test with different data** - Use LangFuse playground with sample variables
- ✅ **Track variable usage** - See which variables are actually used

### For Developers
- ✅ **Clean separation** - Prompt structure in LangFuse, data in code
- ✅ **Type safety** - Variables validated in code
- ✅ **Flexibility** - Easy to add/remove variables
- ✅ **Maintainable** - Clear variable contract

### For Operations
- ✅ **Prompt updates** - Change structure without code deploy
- ✅ **Debugging** - See exact prompt with injected values in traces
- ✅ **Versioning** - Track how variable usage changes across versions
- ✅ **A/B testing** - Test different variable arrangements

---

## 📊 LangFuse Trace Details

Each trace now shows:

**Prompt Information:**
- Prompt name: `contact_strategy`
- Prompt version: e.g., `3`
- Variables injected: `lead_details`, `contact_details`, etc.

**Variable Values:**
- Full JSON of each variable's value
- Makes debugging much easier
- Can replay with same data

**Execution Details:**
- Model used
- Token usage
- Tool calls
- Response generated

---

## 🔧 Updating the Prompt in LangFuse

### Current Prompt Structure
Your `contact_strategy` prompt should be updated to use variable syntax:

**Old (without variables):**
```
You are a B2B sales email copywriter...

[Instructions]

Return JSON...
```

**New (with variables):**
```
You are a B2B sales email copywriter...

{{lead_details}}

{{contact_details}}

{{partner_details}}

{{partner_products}}

{{salesman}}

{{output_schema}}

[Instructions]

Return JSON...
```

### Steps to Update
1. Go to LangFuse dashboard
2. Navigate to **Prompts** → `contact_strategy`
3. Click **Edit** or **Create New Version**
4. Add the `{{variable}}` placeholders where you want data injected
5. **Save and Publish**

---

## 🧪 Testing

### Build
```bash
npm run build
# ✅ Success
```

### Lint
```bash
npm run lint
# ✅ 0 errors, 0 warnings
```

### Manual Test
1. Update `contact_strategy` prompt in LangFuse with variables
2. Trigger contact strategy generation via API or UI
3. Check LangFuse trace to see:
   - ✅ Prompt version used
   - ✅ Variables injected
   - ✅ Compiled prompt
   - ✅ Agent execution
   - ✅ Tool calls
   - ✅ Final output

---

## 📖 Example LangFuse Prompt Template

Here's how to structure the `contact_strategy` prompt in LangFuse:

```
You are a B2B sales email copywriter creating personalized subject lines and bodies for a predefined outreach campaign sequence.  
Act as a human sales rep. Do not reveal that we scraped their site or that you are an AI.

## LEAD/COMPANY INFORMATION
{{lead_details}}

## CONTACT INFORMATION
{{contact_details}}

## YOUR ORGANIZATION
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

## EMAIL SEQUENCE STRUCTURE
You MUST generate content for the following email IDs:

1. **email_1** - Initial introduction email
2. **email_2** - Follow-up email building context
3. **email_3** - Value proposition email
4. **email_4** - Social proof email
5. **email_5** - Problem-solution email
6. **email_6** - ROI-focused email
7. **email_7** - Urgency email
8. **email_8** - Direct ask email
9. **email_9** - Last chance email
10. **email_10** - Professional breakup email

Return ONLY valid JSON matching the output schema. Do not include markdown, comments, or any other text.
```

---

## 🎓 Key Concept: Variable Injection vs Concatenation

### Variable Injection (✅ Correct)
```typescript
// In LangFuse prompt:
"Hello {{name}}, you work at {{company}}..."

// In code:
const compiled = prompt.compile({
  name: "Alice",
  company: "Acme Corp"
});

// Result:
"Hello Alice, you work at Acme Corp..."

// ✅ LangFuse tracks: name="Alice", company="Acme Corp"
```

### String Concatenation (❌ Wrong)
```typescript
// In LangFuse prompt:
"Hello, here's some info..."

// In code:
const text = prompt.getLangchainPrompt();
const combined = `${text}\n\nName: Alice\nCompany: Acme Corp`;

// ❌ LangFuse doesn't track what data was added
// ❌ Can't change structure in LangFuse
// ❌ Harder to debug
```

---

## ✨ Summary

**Status:** ✅ **Updated to use variable injection**

**What Changed:**
- Now uses `prompt.compile(variables)` for variable injection
- Variables passed as key-value object
- LangFuse tracks injected variables in traces
- Cleaner separation of prompt structure and data

**Next Steps:**
1. Update `contact_strategy` prompt in LangFuse to include `{{variable}}` placeholders
2. Test generation and verify variables appear in traces
3. Iterate on prompt structure as needed

**Benefits:**
- Better observability
- More flexible prompts
- Easier debugging
- True prompt management

🎉 **Proper LangFuse + LangChain integration complete!**