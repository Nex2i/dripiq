# TICKET-013: Provider Integration Testing

## **Priority:** High
## **Estimated Time:** 3-4 days
## **Phase:** 5 - Integration with Existing Codebase
## **Dependencies:** TICKET-009, TICKET-010, TICKET-011, TICKET-012

---

## **Description**
Create comprehensive integration tests for all email providers to ensure they work correctly with the provider factory, handle errors properly, and integrate seamlessly with the existing email system.

## **Acceptance Criteria**

### **Must Have**
- [ ] Create integration test suite for all email providers
- [ ] Test provider factory creation and caching
- [ ] Test provider failover and error handling
- [ ] Validate email sending functionality across all providers
- [ ] Test configuration loading from database
- [ ] Include performance benchmarking

### **Should Have**
- [ ] Test provider health monitoring
- [ ] Validate connection pooling for SMTP
- [ ] Test OAuth2 token refresh for cloud providers
- [ ] Include load testing for high-volume scenarios

### **Could Have**
- [ ] Test provider-specific features
- [ ] Validate webhook integration compatibility
- [ ] Test cross-provider failover scenarios

## **Technical Requirements**

### **Test Structure**
```
server/src/libs/email/__tests__/integration/
├── EmailProviderFactory.integration.test.ts
├── SendGridProvider.integration.test.ts
├── SMTPProvider.integration.test.ts
├── MicrosoftGraphProvider.integration.test.ts
├── GoogleWorkspaceProvider.integration.test.ts
├── ProviderFailover.integration.test.ts
└── ProviderPerformance.integration.test.ts
```

### **Provider Factory Integration Tests**
**File:** `server/src/libs/email/__tests__/integration/EmailProviderFactory.integration.test.ts`

```typescript
import { EmailProviderFactory } from '../../EmailProviderFactory';
import { emailProviderConfigRepository } from '@/repositories';
import type { ProviderConfig } from '../../types/EmailConfig.types';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { setupTestProviders, cleanupTestProviders } from '../helpers/providers';

describe('EmailProviderFactory Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await setupTestProviders();
  });

  afterAll(async () => {
    await cleanupTestProviders();
    await cleanupTestDatabase();
  });

  afterEach(async () => {
    EmailProviderFactory.clearCache();
  });

  describe('Provider Creation', () => {
    it('should create SendGrid provider from database config', async () => {
      // Create test config in database
      const config = await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'sendgrid',
        name: 'Test SendGrid',
        config: { apiKey: 'test-key' },
        isDefault: true,
        isActive: true,
      });

      const provider = await EmailProviderFactory.createProvider(config);

      expect(provider.providerType).toBe('sendgrid');
      expect(provider.config.tenantId).toBe('test-tenant');
      expect(provider.capabilities.supportsSenderValidation).toBe(true);
    });

    it('should create SMTP provider from database config', async () => {
      const config = await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'smtp',
        name: 'Test SMTP',
        config: {
          host: 'localhost',
          port: 1025,
          secure: false,
          auth: { type: 'login', user: 'test', pass: 'test' },
        },
        isDefault: false,
        isActive: true,
      });

      const provider = await EmailProviderFactory.createProvider(config);

      expect(provider.providerType).toBe('smtp');
      expect(provider.capabilities.supportsWebhooks).toBe(false);
    });

    it('should cache providers correctly', async () => {
      const config = await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'sendgrid',
        name: 'Cached Provider',
        config: { apiKey: 'test-key' },
        isDefault: true,
        isActive: true,
      });

      const provider1 = await EmailProviderFactory.createProvider(config);
      const provider2 = await EmailProviderFactory.createProvider(config);

      expect(provider1).toBe(provider2); // Same instance from cache
    });

    it('should handle invalid configurations', async () => {
      const invalidConfig = {
        type: 'smtp' as const,
        tenantId: 'test-tenant',
        name: 'Invalid SMTP',
        config: {
          host: 'nonexistent.server.com',
          port: 587,
          secure: false,
          auth: { type: 'login' as const, user: 'invalid', pass: 'invalid' },
        },
        isDefault: false,
        isActive: true,
      };

      await expect(EmailProviderFactory.createProvider(invalidConfig))
        .rejects.toThrow('Provider connection test failed');
    });
  });

  describe('Provider Discovery', () => {
    beforeEach(async () => {
      // Set up multiple providers for testing
      await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'sendgrid',
        name: 'Primary SendGrid',
        config: { apiKey: 'test-key-1' },
        isDefault: true,
        isActive: true,
      });

      await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'smtp',
        name: 'Backup SMTP',
        config: {
          host: 'localhost',
          port: 1025,
          secure: false,
          auth: { type: 'login', user: 'test', pass: 'test' },
        },
        isDefault: false,
        isActive: true,
      });
    });

    it('should get default provider for tenant', async () => {
      const provider = await EmailProviderFactory.getProviderForTenant('test-tenant');

      expect(provider.providerType).toBe('sendgrid');
      expect(provider.config.isDefault).toBe(true);
    });

    it('should get specific provider by name', async () => {
      const provider = await EmailProviderFactory.getProviderForTenant(
        'test-tenant', 
        'Backup SMTP'
      );

      expect(provider.providerType).toBe('smtp');
      expect(provider.config.name).toBe('Backup SMTP');
    });

    it('should get all available providers', async () => {
      const providers = await EmailProviderFactory.getAvailableProviders('test-tenant');

      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.providerType)).toContain('sendgrid');
      expect(providers.map(p => p.providerType)).toContain('smtp');
    });
  });

  describe('Provider Health Checking', () => {
    it('should test all providers for tenant', async () => {
      await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'sendgrid',
        name: 'Healthy Provider',
        config: { apiKey: process.env.SENDGRID_TEST_API_KEY || 'invalid' },
        isDefault: true,
        isActive: true,
      });

      const results = await EmailProviderFactory.testAllProviders('test-tenant');

      expect(results.size).toBeGreaterThan(0);
      expect(results.has('Healthy Provider')).toBe(true);
    });

    it('should handle unhealthy providers gracefully', async () => {
      await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'smtp',
        name: 'Unhealthy Provider',
        config: {
          host: 'nonexistent.server.com',
          port: 587,
          secure: false,
          auth: { type: 'login', user: 'invalid', pass: 'invalid' },
        },
        isDefault: false,
        isActive: true,
      });

      const results = await EmailProviderFactory.testAllProviders('test-tenant');
      
      expect(results.get('Unhealthy Provider')).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache by tenant', async () => {
      const config = await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'sendgrid',
        name: 'Cacheable Provider',
        config: { apiKey: 'test-key' },
        isDefault: true,
        isActive: true,
      });

      // Create and cache provider
      const provider1 = await EmailProviderFactory.createProvider(config);
      
      // Clear cache for tenant
      EmailProviderFactory.clearCache('test-tenant');
      
      // Should create new instance
      const provider2 = await EmailProviderFactory.createProvider(config);
      
      expect(provider1).not.toBe(provider2);
    });

    it('should clear entire cache', async () => {
      const config = await emailProviderConfigRepository.createForTenant('test-tenant', {
        type: 'sendgrid',
        name: 'Global Cache Test',
        config: { apiKey: 'test-key' },
        isDefault: true,
        isActive: true,
      });

      await EmailProviderFactory.createProvider(config);
      
      EmailProviderFactory.clearCache(); // Clear all
      
      // Should be empty cache
      const newProvider = await EmailProviderFactory.createProvider(config);
      expect(newProvider).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tenant configurations', async () => {
      await expect(EmailProviderFactory.getProviderForTenant('nonexistent-tenant'))
        .rejects.toThrow('No provider configuration found');
    });

    it('should handle missing provider names', async () => {
      await expect(EmailProviderFactory.getProviderForTenant('test-tenant', 'nonexistent'))
        .rejects.toThrow('Provider configuration not found');
    });

    it('should handle database connection errors', async () => {
      // Mock database error
      jest.spyOn(emailProviderConfigRepository, 'findDefaultForTenant')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(EmailProviderFactory.getProviderForTenant('test-tenant'))
        .rejects.toThrow('Database connection failed');
    });
  });
});
```

### **Provider-Specific Integration Tests**
**File:** `server/src/libs/email/__tests__/integration/SMTPProvider.integration.test.ts`

```typescript
import { SMTPProvider } from '../../providers/SMTPProvider';
import type { SMTPConfig } from '../../types/EmailConfig.types';
import { startTestSMTPServer, stopTestSMTPServer } from '../helpers/smtp-server';

describe('SMTPProvider Integration', () => {
  let testSMTPServer: any;
  let smtpConfig: SMTPConfig;

  beforeAll(async () => {
    testSMTPServer = await startTestSMTPServer(1025);
    
    smtpConfig = {
      type: 'smtp',
      tenantId: 'test-tenant',
      name: 'Test SMTP',
      host: 'localhost',
      port: 1025,
      secure: false,
      auth: {
        type: 'login',
        user: 'test',
        pass: 'test',
      },
      isDefault: true,
      isActive: true,
    };
  });

  afterAll(async () => {
    await stopTestSMTPServer(testSMTPServer);
  });

  describe('Connection Management', () => {
    it('should establish SMTP connection', async () => {
      const provider = new SMTPProvider(smtpConfig);
      await provider.initialize();

      const result = await provider.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeGreaterThan(0);
      
      await provider.cleanup();
    });

    it('should handle connection failures', async () => {
      const invalidConfig = {
        ...smtpConfig,
        host: 'nonexistent.server.com',
        port: 9999,
      };

      const provider = new SMTPProvider(invalidConfig);
      
      const result = await provider.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('connect');
    });

    it('should handle authentication failures', async () => {
      const invalidAuthConfig = {
        ...smtpConfig,
        auth: {
          type: 'login' as const,
          user: 'invalid',
          pass: 'invalid',
        },
      };

      const provider = new SMTPProvider(invalidAuthConfig);
      
      const result = await provider.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('authentication');
    });
  });

  describe('Email Sending', () => {
    let provider: SMTPProvider;

    beforeEach(async () => {
      provider = new SMTPProvider(smtpConfig);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should send text email', async () => {
      const result = await provider.sendEmail({
        from: { email: 'test@example.com', name: 'Test Sender' },
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message body',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.metadata?.accepted).toContain('recipient@example.com');
    });

    it('should send HTML email', async () => {
      const result = await provider.sendEmail({
        from: { email: 'test@example.com' },
        to: 'recipient@example.com',
        subject: 'HTML Test',
        html: '<h1>Test HTML</h1><p>This is a test.</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should send multipart email', async () => {
      const result = await provider.sendEmail({
        from: { email: 'test@example.com' },
        to: 'recipient@example.com',
        subject: 'Multipart Test',
        text: 'Plain text version',
        html: '<p>HTML version</p>',
        headers: { 'X-Test-Header': 'test-value' },
        metadata: { campaignId: 'test-campaign' },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle multiple recipients', async () => {
      const result = await provider.sendEmail({
        from: { email: 'test@example.com' },
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Multiple Recipients',
        text: 'Test message',
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.accepted).toHaveLength(2);
    });

    it('should handle invalid recipients', async () => {
      const result = await provider.sendEmail({
        from: { email: 'test@example.com' },
        to: 'invalid-email',
        subject: 'Invalid Recipient',
        text: 'Test message',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid recipient email');
    });
  });

  describe('Performance', () => {
    let provider: SMTPProvider;

    beforeEach(async () => {
      provider = new SMTPProvider(smtpConfig);
      await provider.initialize();
    });

    afterEach(async () => {
      await provider.cleanup();
    });

    it('should handle concurrent email sending', async () => {
      const emailPromises = Array.from({ length: 10 }, (_, i) =>
        provider.sendEmail({
          from: { email: 'test@example.com' },
          to: `recipient${i}@example.com`,
          subject: `Concurrent Test ${i}`,
          text: `Test message ${i}`,
        })
      );

      const results = await Promise.all(emailPromises);

      expect(results.every(r => r.success)).toBe(true);
      expect(results).toHaveLength(10);
    });

    it('should reuse connections efficiently', async () => {
      const startTime = Date.now();

      // Send multiple emails
      for (let i = 0; i < 5; i++) {
        await provider.sendEmail({
          from: { email: 'test@example.com' },
          to: `recipient${i}@example.com`,
          subject: `Efficiency Test ${i}`,
          text: `Test message ${i}`,
        });
      }

      const totalTime = Date.now() - startTime;
      
      // Should be faster than creating new connections each time
      expect(totalTime).toBeLessThan(5000); // 5 seconds
    });
  });
});
```

### **Performance Benchmarking**
**File:** `server/src/libs/email/__tests__/integration/ProviderPerformance.integration.test.ts`

```typescript
import { EmailProviderFactory } from '../../EmailProviderFactory';
import { setupTestProviders } from '../helpers/providers';

describe('Provider Performance Benchmarks', () => {
  beforeAll(async () => {
    await setupTestProviders();
  });

  describe('Provider Creation Performance', () => {
    it('should create providers within performance threshold', async () => {
      const providers = ['sendgrid', 'smtp', 'microsoft_graph', 'google_workspace'];
      const creationTimes: Record<string, number> = {};

      for (const providerType of providers) {
        const startTime = Date.now();
        
        try {
          const config = await getTestConfig(providerType as any);
          await EmailProviderFactory.createProvider(config);
          creationTimes[providerType] = Date.now() - startTime;
        } catch (error) {
          // Skip providers that aren't configured for testing
          creationTimes[providerType] = -1;
        }
      }

      // Log performance results
      console.log('Provider Creation Times:', creationTimes);

      // Verify creation times are reasonable (< 2 seconds)
      Object.entries(creationTimes).forEach(([provider, time]) => {
        if (time > 0) {
          expect(time).toBeLessThan(2000);
        }
      });
    });

    it('should cache providers efficiently', async () => {
      const config = await getTestConfig('sendgrid');
      
      // First creation (uncached)
      const start1 = Date.now();
      const provider1 = await EmailProviderFactory.createProvider(config);
      const time1 = Date.now() - start1;

      // Second creation (cached)
      const start2 = Date.now();
      const provider2 = await EmailProviderFactory.createProvider(config);
      const time2 = Date.now() - start2;

      expect(provider1).toBe(provider2); // Same instance
      expect(time2).toBeLessThan(time1 / 10); // Cached should be much faster
      expect(time2).toBeLessThan(10); // < 10ms
    });
  });

  describe('Email Sending Performance', () => {
    it('should send emails within latency threshold', async () => {
      const config = await getTestConfig('smtp'); // Use local SMTP for consistent testing
      const provider = await EmailProviderFactory.createProvider(config);

      const latencies: number[] = [];

      // Send 10 test emails and measure latency
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const result = await provider.sendEmail({
          from: { email: 'test@example.com' },
          to: 'recipient@example.com',
          subject: `Performance Test ${i}`,
          text: 'Performance test message',
        });

        const latency = Date.now() - startTime;
        latencies.push(latency);

        expect(result.success).toBe(true);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      console.log(`Email Sending Performance:`, {
        averageLatency: avgLatency,
        maxLatency: maxLatency,
        latencies,
      });

      // Performance thresholds
      expect(avgLatency).toBeLessThan(1000); // < 1 second average
      expect(maxLatency).toBeLessThan(3000);  // < 3 seconds max
    });

    it('should handle concurrent requests efficiently', async () => {
      const config = await getTestConfig('smtp');
      const provider = await EmailProviderFactory.createProvider(config);

      const concurrency = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrency }, (_, i) =>
        provider.sendEmail({
          from: { email: 'test@example.com' },
          to: `recipient${i}@example.com`,
          subject: `Concurrent Test ${i}`,
          text: `Concurrent test message ${i}`,
        })
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(10000); // < 10 seconds for 20 concurrent emails

      const avgTimePerEmail = totalTime / concurrency;
      expect(avgTimePerEmail).toBeLessThan(500); // < 500ms per email when concurrent
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during provider creation/destruction', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and destroy many providers
      for (let i = 0; i < 100; i++) {
        const config = await getTestConfig('sendgrid');
        const provider = await EmailProviderFactory.createProvider(config);
        
        if (provider.cleanup) {
          await provider.cleanup();
        }
        
        EmailProviderFactory.clearCache();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

// Helper function to get test configurations
async function getTestConfig(providerType: string): Promise<any> {
  const configs = {
    sendgrid: {
      type: 'sendgrid',
      tenantId: 'test-tenant',
      name: 'Test SendGrid',
      config: { apiKey: process.env.SENDGRID_TEST_API_KEY || 'test-key' },
      isDefault: true,
      isActive: true,
    },
    smtp: {
      type: 'smtp',
      tenantId: 'test-tenant',
      name: 'Test SMTP',
      config: {
        host: 'localhost',
        port: 1025,
        secure: false,
        auth: { type: 'login', user: 'test', pass: 'test' },
      },
      isDefault: false,
      isActive: true,
    },
    // Add other provider configs as needed
  };

  return configs[providerType];
}
```

## **Test Helpers and Utilities**

### **Database Test Helper**
**File:** `server/src/libs/email/__tests__/helpers/database.ts`

```typescript
import { db } from '@/db';
import { emailProviderConfigs, emailProviderTokens, tenants } from '@/db/schema';

export async function setupTestDatabase(): Promise<void> {
  // Create test tenant
  await db.insert(tenants).values({
    id: 'test-tenant',
    name: 'Test Tenant',
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();
}

export async function cleanupTestDatabase(): Promise<void> {
  // Clean up test data
  await db.delete(emailProviderTokens);
  await db.delete(emailProviderConfigs);
  // Note: Don't delete tenant as other tests might use it
}
```

### **SMTP Test Server Helper**
**File:** `server/src/libs/email/__tests__/helpers/smtp-server.ts`

```typescript
import { SMTPServer } from 'smtp-server';

export async function startTestSMTPServer(port: number): Promise<SMTPServer> {
  const server = new SMTPServer({
    authRequired: true,
    onAuth: (auth, session, callback) => {
      if (auth.username === 'test' && auth.password === 'test') {
        return callback(null, { user: 'test' });
      }
      return callback(new Error('Invalid credentials'));
    },
    onData: (stream, session, callback) => {
      // Simply accept all emails for testing
      stream.on('data', () => {}); // Consume data
      stream.on('end', () => {
        callback(null, 'Message accepted for testing');
      });
    },
  });

  return new Promise((resolve, reject) => {
    server.listen(port, (err?: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve(server);
      }
    });
  });
}

export async function stopTestSMTPServer(server: SMTPServer): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}
```

## **CI/CD Integration**

### **Test Configuration**
**File:** `server/jest.integration.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/libs/email/__tests__/setup.ts'],
  testTimeout: 30000, // 30 seconds for integration tests
  maxWorkers: 2, // Limit concurrent tests
};
```

### **GitHub Actions Workflow**
```yaml
name: Provider Integration Tests

on:
  pull_request:
    paths:
      - 'server/src/libs/email/**'
  push:
    branches: [main]

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: npm run db:setup:test
        
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          SENDGRID_TEST_API_KEY: ${{ secrets.SENDGRID_TEST_API_KEY }}
```

## **Performance Monitoring**

### **Benchmarking Suite**
- [ ] Email sending latency benchmarks
- [ ] Provider creation performance
- [ ] Memory usage monitoring
- [ ] Concurrent request handling

### **Performance Thresholds**
- [ ] Provider creation: < 2 seconds
- [ ] Email sending: < 1 second average
- [ ] Memory usage: < 10MB increase per 100 operations
- [ ] Concurrent handling: 20 emails in < 10 seconds

## **Documentation Requirements**
- [ ] Integration test setup guide
- [ ] Performance benchmarking documentation
- [ ] CI/CD configuration guide
- [ ] Troubleshooting guide for test failures

## **Definition of Done**
- [ ] All provider integration tests implemented
- [ ] Provider factory integration tests working
- [ ] Performance benchmarks established
- [ ] CI/CD integration configured
- [ ] All tests passing consistently
- [ ] Performance thresholds met
- [ ] Documentation completed
- [ ] Code review completed

## **Notes**
- Use real test accounts for cloud providers when possible
- Mock external services for unit tests, real services for integration
- Monitor test execution time to prevent CI/CD slowdowns
- Include performance regression detection

## **Related Tickets**
- TICKET-009: SendGrid Provider Implementation (prerequisite)
- TICKET-010: SMTP Provider Implementation (prerequisite)
- TICKET-011: Microsoft Graph Provider Implementation (prerequisite)
- TICKET-012: Google Workspace Provider Implementation (prerequisite)
- TICKET-014: Data Migration and Backward Compatibility