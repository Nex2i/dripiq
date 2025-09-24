require('./dist/extensions/index.js');
const { EmailValidationService } = require('./dist/libs/email-validation/emailValidation.service.js');

async function testInvalidRyan() {
  console.log('🔍 Testing invalid Ryan email');
  console.log('==============================\n');
  
  const emails = [
    'ryanhutchison@filevine.com',      // Valid (should pass)
    'ryanhutchisonnnnn@filevine.com'   // Invalid (should fail)
  ];
  
  const service = EmailValidationService.createDefault();
  
  for (const email of emails) {
    console.log(`📧 Testing: ${email}`);
    
    try {
      const result = await service.validateEmail(email);
      console.log(`   Result: ${result.status}/${result.sub_status || 'null'}`);
      
      if (email.includes('nnnn')) {
        console.log('   ZeroBounce: invalid/mailbox_not_found');
        console.log(`   ${result.status === 'invalid' ? '✅ MATCH' : '❌ MISMATCH - should be invalid'}`);
      } else {
        console.log('   ZeroBounce: valid/None');
        console.log(`   ${result.status === 'valid' ? '✅ MATCH' : '❌ MISMATCH - should be valid'}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
}

testInvalidRyan();