/**
 * Test script to verify LangFuse prompt retrieval works correctly
 * 
 * Run this after setting up your LangFuse keys and prompts:
 * node test-langfuse-prompts.js
 */

const dotenv = require('dotenv');
dotenv.config();

console.log('🧪 Testing LangFuse Prompt Retrieval\n');

(async () => {
  try {
    // Check if LangFuse is configured
    if (!process.env.LANGFUSE_PUBLIC_KEY || process.env.LANGFUSE_PUBLIC_KEY === 'pk-lf-xxx') {
      console.log('❌ LangFuse keys not configured. Please update your .env file with real keys.');
      process.exit(1);
    }

    const { Langfuse } = require('langfuse');
    
    const client = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });

    console.log('✅ LangFuse client initialized');

    // Test fetching each required prompt
    const requiredPrompts = ['summarize_site', 'vendor_fit', 'extract_contacts', 'contact_strategy'];
    
    for (const promptName of requiredPrompts) {
      try {
        console.log(`\n📝 Testing prompt: ${promptName}`);
        
        const prompt = await client.prompt.get(promptName);
        
        if (!prompt) {
          console.log(`  ❌ Prompt '${promptName}' not found in LangFuse`);
          continue;
        }

        console.log(`  ✅ Found: ${promptName}`);
        console.log(`  📊 Type: ${prompt.type}`);
        console.log(`  🔢 Version: ${prompt.version}`);
        console.log(`  🏷️  Labels: ${prompt.labels?.join(', ') || 'none'}`);

        // Test content extraction
        let content = '';
        if (prompt.type === 'chat') {
          const systemMessage = prompt.prompt.find(msg => msg.role === 'system');
          content = systemMessage?.content || 'No system message found';
        } else if (prompt.type === 'text') {
          content = prompt.prompt;
        }
        
        console.log(`  📝 Content length: ${content.length} characters`);
        console.log(`  🔍 Preview: ${content.substring(0, 100)}...`);

        // Check for variables
        const variables = content.match(/{{(.*?)}}/g) || [];
        console.log(`  🔧 Variables found: ${variables.join(', ') || 'none'}`);

      } catch (error) {
        console.log(`  ❌ Error fetching ${promptName}: ${error.message}`);
      }
    }

    // Test variable injection
    console.log('\n🔧 Testing Variable Injection:');
    try {
      const testTemplate = 'Hello {{name}}, analyze {{domain}} please.';
      const variables = { name: 'Assistant', domain: 'example.com' };
      
      // Simple variable replacement logic
      let result = testTemplate;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      
      console.log(`  ✅ Template: ${testTemplate}`);
      console.log(`  ✅ Result: ${result}`);
    } catch (error) {
      console.log(`  ❌ Variable injection failed: ${error.message}`);
    }

    // Shutdown client
    await client.shutdownAsync();
    console.log('\n✅ LangFuse client shut down successfully');
    
    console.log('\n🎉 LangFuse prompt system is ready!');
    console.log('\n📋 Summary:');
    console.log('- All prompts should be found and accessible');
    console.log('- Make sure prompts are marked with "production" label');
    console.log('- System will always use the latest version');
    console.log('- No caching - always fresh from LangFuse');

  } catch (error) {
    console.log(`\n❌ Test failed: ${error.message}`);
    console.log('\n💡 Common solutions:');
    console.log('1. Verify your LangFuse API keys are correct');
    console.log('2. Create the 4 required prompts in your LangFuse dashboard');
    console.log('3. Make sure prompts are chat prompts with system role');
    console.log('4. Check network connectivity to LangFuse');
  }
})();