require('./dist/extensions/index.js');
const { SmtpValidator } = require('./dist/libs/email-validation/infrastructure/smtpValidator.js');

async function debugMicrosoftSmtp() {
  console.log('🔍 Debugging Microsoft SMTP validation');
  console.log('=====================================\n');
  
  const emails = [
    'ryanhutchison@filevine.com',      // Valid
    'ryanhutchisonnnnn@filevine.com'   // Invalid
  ];
  
  const mxRecord = 'filevine-com.mail.protection.outlook.com';
  
  // Test with different timeout settings
  const validators = [
    { name: 'Ultra-fast (500ms, 0 retries)', validator: new SmtpValidator(500, 0) },
    { name: 'Fast (1500ms, 0 retries)', validator: new SmtpValidator(1500, 0) },
    { name: 'Normal (3000ms, 1 retry)', validator: new SmtpValidator(3000, 1) }
  ];
  
  for (const email of emails) {
    console.log(`📧 ${email}`);
    console.log('─'.repeat(50));
    
    for (const config of validators) {
      console.log(`   Testing with ${config.name}:`);
      
      const startTime = Date.now();
      try {
        const result = await config.validator.validateEmail(email, mxRecord);
        const duration = Date.now() - startTime;
        
        console.log(`     Result: isValid=${result.isValid}, time=${duration}ms`);
        console.log(`     Error: "${result.errorMessage || 'none'}"`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`     Exception after ${duration}ms: ${error.message}`);
      }
    }
    
    console.log('');
  }
  
  console.log('💡 Analysis: Looking for patterns that differentiate valid vs invalid emails');
}

debugMicrosoftSmtp();