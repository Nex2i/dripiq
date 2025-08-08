# Ticket 03: SendGrid Integration

**Epic**: Foundation (Phase 1)  
**Story Points**: 5  
**Priority**: Critical  
**Dependencies**: None

## Objective

Set up basic SendGrid integration including email client configuration, Email Address Validation API integration, and sender domain authentication. This provides the foundation for email sending and contact validation.

## Acceptance Criteria

- [ ] SendGrid client configured with API key management
- [ ] Email Address Validation API integration working
- [ ] Basic email sending functionality implemented
- [ ] Error handling for SendGrid API responses
- [ ] Rate limiting for validation API calls
- [ ] Support for custom tracking and metadata
- [ ] Environment-based configuration (dev/prod)

## Technical Requirements

### SendGrid Features to Implement

1. **Email Sending**: Basic send functionality with tracking
2. **Email Validation**: Integration with Validation API
3. **Sender Authentication**: Domain verification support
4. **Error Handling**: Proper API error classification
5. **Rate Limiting**: Validation API has strict limits

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd server
npm install @sendgrid/mail @sendgrid/client
npm install --save-dev @types/node
```

### Step 2: SendGrid Client Setup

Create `server/src/libs/sendgrid/client.ts`:

```typescript
import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import { logger } from '../logger';

export interface SendGridConfig {
  apiKey: string;
  environment: 'development' | 'production';
  defaultFromEmail?: string;
  defaultFromName?: string;
}

export interface SendEmailParams {
  to: string;
  from: { email: string; name: string };
  subject: string;
  html: string;
  text?: string;
  customArgs?: Record<string, string>;
  categories?: string[];
  trackingSettings?: {
    clickTracking?: { enable: boolean; enableText?: boolean };
    openTracking?: { enable: boolean; substitutionTag?: string };
    subscriptionTracking?: { enable: boolean };
  };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

class SendGridClient {
  private config: SendGridConfig;
  private initialized = false;

  constructor() {
    this.config = {
      apiKey: process.env.SENDGRID_API_KEY!,
      environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',
      defaultFromEmail: process.env.SENDGRID_DEFAULT_FROM_EMAIL,
      defaultFromName: process.env.SENDGRID_DEFAULT_FROM_NAME,
    };
  }

  async initialize() {
    if (this.initialized) return;

    if (!this.config.apiKey) {
      throw new Error('SendGrid API key not configured');
    }

    // Set API key for both mail and client
    sgMail.setApiKey(this.config.apiKey);
    sgClient.setApiKey(this.config.apiKey);

    // Test API key validity
    try {
      await this.testConnection();
      this.initialized = true;
      logger.info('SendGrid client initialized successfully');
    } catch (error) {
      logger.error('SendGrid initialization failed', { error: error.message });
      throw error;
    }
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        html: params.html,
        text: params.text || this.stripHtml(params.html),
        customArgs: params.customArgs,
        categories: params.categories,
        trackingSettings: {
          clickTracking: {
            enable: params.trackingSettings?.clickTracking?.enable ?? true,
            enableText: params.trackingSettings?.clickTracking?.enableText ?? false,
          },
          openTracking: {
            enable: params.trackingSettings?.openTracking?.enable ?? true,
            substitutionTag: params.trackingSettings?.openTracking?.substitutionTag,
          },
          subscriptionTracking: {
            enable: params.trackingSettings?.subscriptionTracking?.enable ?? false,
          },
        },
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode,
      };

    } catch (error) {
      logger.error('SendGrid send failed', { 
        error: error.message,
        to: params.to,
        from: params.from.email,
        statusCode: error.code,
      });

      return {
        success: false,
        error: error.message,
        statusCode: error.code,
      };
    }
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const request = {
        url: '/v3/validations/email',
        method: 'POST' as const,
        body: {
          email: email,
          source: 'signup', // or 'list' depending on context
        },
      };

      const [response] = await sgClient.request(request);
      
      return {
        email,
        isValid: response.body.result.verdict === 'Valid',
        result: response.body.result.verdict,
        score: response.body.result.score,
        local: response.body.result.local,
        host: response.body.result.host,
        suggestion: response.body.result.suggestion,
        rawResponse: response.body,
      };

    } catch (error) {
      logger.error('Email validation failed', { 
        email, 
        error: error.message,
        statusCode: error.code,
      });

      return {
        email,
        isValid: false,
        result: 'Error',
        error: error.message,
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const request = {
        url: '/v3/user/account',
        method: 'GET' as const,
      };

      await sgClient.request(request);
      return true;
    } catch (error) {
      throw new Error(`SendGrid connection test failed: ${error.message}`);
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  result: string; // 'Valid', 'Risky', 'Invalid', 'Error'
  score?: number;
  local?: string;
  host?: string;
  suggestion?: string;
  error?: string;
  rawResponse?: any;
}

export const sendgridClient = new SendGridClient();
```

### Step 3: Rate Limiter for Validation API

Create `server/src/libs/sendgrid/validation.limiter.ts`:

```typescript
import { Redis } from 'ioredis';
import { redisConfig } from '../../config/redis.config';
import { logger } from '../logger';

export class ValidationRateLimiter {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis(redisConfig);
  }

  async checkValidationLimit(): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    // SendGrid Email Validation API: 10,000 validations per month
    // Conservative limit: 300 per day (9,000 per month)
    const key = 'sendgrid:validation:daily';
    const limit = 300;
    const windowSeconds = 24 * 60 * 60; // 24 hours

    const pipeline = this.redis.pipeline();
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Remove old entries and add current request
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, now);
    pipeline.zcard(key);
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();
    const count = results![2][1] as number;

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetTime = now + (windowSeconds * 1000);

    if (!allowed) {
      logger.warn('SendGrid validation rate limit exceeded', { 
        count, 
        limit, 
        remaining 
      });
    }

    return { allowed, remaining, resetTime };
  }

  async close() {
    await this.redis.disconnect();
  }
}
```

### Step 4: Validation Service

Create `server/src/services/email.validation.service.ts`:

```typescript
import { sendgridClient } from '../libs/sendgrid/client';
import { ValidationRateLimiter } from '../libs/sendgrid/validation.limiter';
import { db } from '../db';
import { emailValidationResults } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../libs/logger';
import { createId } from '@paralleldrive/cuid2';

export class EmailValidationService {
  private rateLimiter: ValidationRateLimiter;

  constructor() {
    this.rateLimiter = new ValidationRateLimiter();
  }

  async validateEmail(
    tenantId: string, 
    email: string, 
    contactId?: string
  ): Promise<{ isValid: boolean; result: string; cached: boolean }> {
    
    // Check if we already have a cached result
    const cached = await this.getCachedValidation(tenantId, email);
    if (cached) {
      logger.debug('Using cached email validation', { email, result: cached.resultStatus });
      return {
        isValid: cached.resultStatus === 'valid',
        result: cached.resultStatus,
        cached: true,
      };
    }

    // Check rate limit
    const rateLimitCheck = await this.rateLimiter.checkValidationLimit();
    if (!rateLimitCheck.allowed) {
      logger.warn('Email validation rate limit exceeded', { 
        email,
        remaining: rateLimitCheck.remaining 
      });
      
      // Return conservative result when rate limited
      return {
        isValid: false,
        result: 'rate_limited',
        cached: false,
      };
    }

    // Perform validation
    try {
      const validation = await sendgridClient.validateEmail(email);
      
      // Store result in cache
      await this.cacheValidationResult(tenantId, email, contactId, validation);
      
      return {
        isValid: validation.isValid,
        result: validation.result.toLowerCase(),
        cached: false,
      };

    } catch (error) {
      logger.error('Email validation service error', { 
        email, 
        error: error.message 
      });
      
      // Return conservative result on error
      return {
        isValid: false,
        result: 'error',
        cached: false,
      };
    }
  }

  private async getCachedValidation(tenantId: string, email: string) {
    const [result] = await db
      .select()
      .from(emailValidationResults)
      .where(
        and(
          eq(emailValidationResults.tenantId, tenantId),
          eq(emailValidationResults.email, email)
        )
      )
      .orderBy(desc(emailValidationResults.validatedAt))
      .limit(1);

    // Only use cache if result is less than 30 days old
    if (result && (Date.now() - result.validatedAt.getTime()) < 30 * 24 * 60 * 60 * 1000) {
      return result;
    }

    return null;
  }

  private async cacheValidationResult(
    tenantId: string, 
    email: string, 
    contactId: string | undefined, 
    validation: any
  ) {
    try {
      await db.insert(emailValidationResults).values({
        id: createId(),
        tenantId,
        contactId,
        email,
        resultStatus: validation.result.toLowerCase(),
        score: validation.score,
        didYouMean: validation.suggestion,
        raw: validation.rawResponse,
        validatedAt: new Date(),
        createdAt: new Date(),
      }).onConflictDoUpdate({
        target: [emailValidationResults.tenantId, emailValidationResults.email],
        set: {
          resultStatus: validation.result.toLowerCase(),
          score: validation.score,
          didYouMean: validation.suggestion,
          raw: validation.rawResponse,
          validatedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to cache validation result', { 
        email, 
        error: error.message 
      });
      // Don't throw - caching failure shouldn't break validation
    }
  }

  async close() {
    await this.rateLimiter.close();
  }
}

export const emailValidationService = new EmailValidationService();
```

### Step 5: Configuration and Environment

Add to `.env`:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_DEFAULT_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_DEFAULT_FROM_NAME="Your Company"

# Webhook Configuration (for later tickets)
SENDGRID_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

### Step 6: Initialize in Server

Update `server/src/index.ts`:

```typescript
import { sendgridClient } from './libs/sendgrid/client';

async function startServer() {
  try {
    // Initialize SendGrid
    await sendgridClient.initialize();
    
    // ... existing server setup
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}
```

## File Structure

```
server/src/
├── libs/
│   └── sendgrid/
│       ├── client.ts                # Main SendGrid client
│       └── validation.limiter.ts    # Rate limiting for validation API
├── services/
│   └── email.validation.service.ts  # Email validation service
└── config/
    └── sendgrid.config.ts           # SendGrid configuration
```

## Testing Requirements

No unit tests at this time.

### Integration Tests

```typescript
describe('SendGrid Integration', () => {
  test('end-to-end email sending', async () => {
    // Test with real SendGrid sandbox
    // Verify tracking headers are set
    // Check custom args are included
  });
});
```

## Error Handling

### SendGrid API Errors

```typescript
// Common error codes and handling
const handleSendGridError = (error: any) => {
  switch (error.code) {
    case 401:
      return 'Invalid API key';
    case 413:
      return 'Email content too large';
    case 429:
      return 'Rate limit exceeded';
    case 400:
      return 'Invalid email format or content';
    default:
      return 'SendGrid API error';
  }
};
```

## Performance Considerations

### Rate Limiting
- **Email Sending**: No built-in limits, but respect best practices
- **Email Validation**: 10,000/month limit, cache aggressively
- **Connection Pooling**: Reuse HTTP connections

### Caching Strategy
- Cache validation results for 30 days
- Store raw responses for debugging
- Use database constraints to prevent duplicates

## Security Considerations

### API Key Management
- Store API key in environment variables only
- Rotate keys regularly
- Use different keys for dev/staging/prod

### Email Security
- Validate all email addresses before sending
- Sanitize HTML content
- Use tracking with caution for privacy

## Definition of Done

- [ ] SendGrid client configured and tested
- [ ] Email sending working with tracking
- [ ] Email validation API integrated with caching
- [ ] Rate limiting implemented for validation
- [ ] Error handling for all API responses
- [ ] Environment configuration working
- [ ] Documentation updated