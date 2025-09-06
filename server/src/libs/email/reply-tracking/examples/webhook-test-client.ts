/**
 * Webhook Test Client
 * 
 * This utility helps test webhook endpoints by simulating notifications
 * from Gmail and Outlook services.
 */

import axios from 'axios';

interface WebhookTestConfig {
  baseUrl: string;
  timeout?: number;
}

export class WebhookTestClient {
  private config: WebhookTestConfig;

  constructor(config: WebhookTestConfig) {
    this.config = {
      timeout: 5000,
      ...config,
    };
  }

  /**
   * Test Gmail webhook endpoint with a simulated Pub/Sub notification
   */
  async testGmailWebhook(emailAddress: string = 'test@gmail.com'): Promise<any> {
    const payload = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress,
          historyId: Date.now().toString(),
        })).toString('base64'),
        messageId: `test-message-${Date.now()}`,
        publishTime: new Date().toISOString(),
      },
      subscription: 'projects/test-project/subscriptions/gmail-notifications',
    };

    console.log('🧪 Testing Gmail webhook with payload:', payload);

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/webhooks/gmail/notifications`,
        payload,
        {
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Gmail webhook test successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Gmail webhook test failed:', error);
      throw error;
    }
  }

  /**
   * Test Outlook webhook endpoint with a simulated Graph notification
   */
  async testOutlookWebhook(subscriptionId: string = 'test-subscription'): Promise<any> {
    const payload = {
      value: [
        {
          subscriptionId,
          clientState: `test-client-state-${Date.now()}`,
          changeType: 'created',
          resource: `/me/mailFolders/inbox/messages/test-message-${Date.now()}`,
          resourceData: {
            '@odata.type': '#Microsoft.Graph.Message',
            '@odata.id': `/me/messages/test-message-${Date.now()}`,
            id: `test-message-${Date.now()}`,
          },
          subscriptionExpirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          tenantId: 'test-tenant-id',
        },
      ],
    };

    console.log('🧪 Testing Outlook webhook with payload:', payload);

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/webhooks/outlook/notifications`,
        payload,
        {
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Outlook webhook test successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Outlook webhook test failed:', error);
      throw error;
    }
  }

  /**
   * Test Outlook webhook validation (initial setup)
   */
  async testOutlookWebhookValidation(validationToken: string = 'test-validation-token'): Promise<any> {
    console.log('🧪 Testing Outlook webhook validation');

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/webhooks/outlook/notifications?validationToken=${validationToken}`,
        {},
        {
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Outlook webhook validation successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Outlook webhook validation failed:', error);
      throw error;
    }
  }

  /**
   * Test generic email reply webhook
   */
  async testGenericEmailWebhook(customData?: Partial<any>): Promise<any> {
    const defaultPayload = {
      providerMessageId: `test-generic-${Date.now()}`,
      fromEmail: 'customer@example.com',
      toEmail: 'sales@yourcompany.com',
      subject: 'Re: Test email reply',
      bodyText: 'This is a test reply message.',
      bodyHtml: '<p>This is a test reply message.</p>',
      messageId: `<test-${Date.now()}@example.com>`,
      inReplyTo: '<original-test-message@yourcompany.com>',
      references: '<original-test-message@yourcompany.com>',
      receivedAt: new Date().toISOString(),
    };

    const payload = { ...defaultPayload, ...customData };

    console.log('🧪 Testing generic email webhook with payload:', payload);

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/webhooks/email/replies`,
        payload,
        {
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ Generic email webhook test successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Generic email webhook test failed:', error);
      throw error;
    }
  }

  /**
   * Run comprehensive webhook tests
   */
  async runAllTests(): Promise<{
    gmail: any;
    outlook: any;
    outlookValidation: any;
    generic: any;
  }> {
    console.log('🚀 Running comprehensive webhook tests...');

    const results = {
      gmail: null as any,
      outlook: null as any,
      outlookValidation: null as any,
      generic: null as any,
    };

    // Test Gmail webhook
    try {
      results.gmail = await this.testGmailWebhook();
    } catch (error) {
      console.error('Gmail webhook test failed:', error);
      results.gmail = { error: error.message };
    }

    // Test Outlook webhook validation
    try {
      results.outlookValidation = await this.testOutlookWebhookValidation();
    } catch (error) {
      console.error('Outlook validation test failed:', error);
      results.outlookValidation = { error: error.message };
    }

    // Test Outlook webhook
    try {
      results.outlook = await this.testOutlookWebhook();
    } catch (error) {
      console.error('Outlook webhook test failed:', error);
      results.outlook = { error: error.message };
    }

    // Test generic webhook
    try {
      results.generic = await this.testGenericEmailWebhook();
    } catch (error) {
      console.error('Generic webhook test failed:', error);
      results.generic = { error: error.message };
    }

    console.log('🏁 All webhook tests completed:', results);
    return results;
  }
}

// Example usage and CLI interface
export async function runWebhookTests(baseUrl: string = 'http://localhost:3000') {
  const testClient = new WebhookTestClient({ baseUrl });

  try {
    const results = await testClient.runAllTests();
    
    const successCount = Object.values(results).filter(result => result && !result.error).length;
    const totalCount = Object.keys(results).length;

    console.log(`\n📊 Test Results: ${successCount}/${totalCount} tests passed`);
    
    if (successCount === totalCount) {
      console.log('🎉 All webhook tests passed!');
    } else {
      console.log('⚠️ Some webhook tests failed. Check the logs above for details.');
    }

    return results;
  } catch (error) {
    console.error('❌ Webhook testing failed:', error);
    throw error;
  }
}

// CLI interface for running tests
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  
  console.log(`🧪 Starting webhook tests against: ${baseUrl}`);
  
  runWebhookTests(baseUrl)
    .then(() => {
      console.log('✅ Webhook testing completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Webhook testing failed:', error);
      process.exit(1);
    });
}

// Export for programmatic use
export { WebhookTestClient };