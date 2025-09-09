# Stripe Integration Epic: Product-Led Growth with Token-Based Billing

## Epic Summary
Implement a comprehensive Stripe integration for product-led growth featuring a token-based billing system. The system will support subscription credits (monthly, non-rolling) and bundle credits (on-demand, rolling) with automatic bundle purchasing when subscription limits are exceeded.

## Architecture Overview
- **Token System**: Subscription credits + Bundle credits
- **Auto-Purchase**: Automatic bundle purchase when subscription credits exhausted  
- **Billing Portal**: Direct integration with Stripe Customer Portal
- **Multi-Tenant**: Tenant-scoped billing with isolated credit pools
- **Real-Time**: Webhook-driven updates for immediate billing changes

---

## Phase 1: Foundation & Database Schema

### Ticket 1.1: Database Schema - Stripe Integration Tables
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 3 story points

**Description:**
Create database tables to support Stripe integration, credit tracking, and billing operations.

**Acceptance Criteria:**
- [ ] Add `stripeCustomerId` and `stripeSubscriptionId` fields to `tenants` table
- [ ] Create `billing_credits` table for tracking subscription and bundle credits
- [ ] Create `credit_transactions` table for audit trail of credit usage
- [ ] Create `billing_usage` table for tracking feature usage
- [ ] Create `stripe_webhooks` table for webhook event logging
- [ ] Create `billing_plans` table for subscription plan definitions
- [ ] Add proper indexes for performance
- [ ] Create Drizzle migration files
- [ ] Update TypeScript types and relations

**Technical Details:**
```sql
-- Add to tenants table
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN billing_email TEXT;

-- New tables needed:
- billing_credits (tenant_id, subscription_credits, bundle_credits, etc.)
- credit_transactions (usage tracking, purchases, refunds)
- billing_usage (feature usage tracking)
- stripe_webhooks (event logging)
- billing_plans (plan definitions)
```

**Dependencies:** None

---

### Ticket 1.2: Stripe Service Layer
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 5 story points

**Description:**
Create a comprehensive Stripe service layer to handle all Stripe API interactions with proper error handling and retry logic.

**Acceptance Criteria:**
- [ ] Install and configure Stripe SDK
- [ ] Create `StripeService` class with customer management methods
- [ ] Implement customer creation and retrieval
- [ ] Implement subscription management methods
- [ ] Add Customer Portal session creation
- [ ] Add webhook signature verification
- [ ] Implement proper error handling and logging
- [ ] Add TypeScript interfaces for Stripe objects
- [ ] Add unit tests for service methods

**Technical Details:**
```typescript
class StripeService {
  async createCustomer(tenantId: string, email: string): Promise<Stripe.Customer>
  async getCustomer(customerId: string): Promise<Stripe.Customer>
  async createPortalSession(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session>
  async createSubscription(customerId: string, priceId: string): Promise<Stripe.Subscription>
  async purchaseCredits(customerId: string, quantity: number): Promise<Stripe.PaymentIntent>
  verifyWebhookSignature(payload: string, signature: string): boolean
}
```

**Dependencies:** Ticket 1.1

---

### Ticket 1.3: Billing Service Layer
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 5 story points

**Description:**
Create billing service to manage credit allocation, usage tracking, and business logic for the token system.

**Acceptance Criteria:**
- [ ] Create `BillingService` class for credit management
- [ ] Implement credit balance checking and deduction
- [ ] Add subscription credit reset logic (monthly)
- [ ] Add bundle credit purchase and allocation
- [ ] Implement usage priority logic (subscription first, then bundles)
- [ ] Add credit transaction logging
- [ ] Create methods for usage reporting and analytics
- [ ] Add proper tenant isolation for all operations
- [ ] Add comprehensive unit tests

**Technical Details:**
```typescript
class BillingService {
  async getCreditBalance(tenantId: string): Promise<{subscription: number, bundle: number}>
  async deductCredits(tenantId: string, amount: number): Promise<CreditTransaction>
  async addCredits(tenantId: string, type: 'subscription' | 'bundle', amount: number): Promise<void>
  async resetSubscriptionCredits(tenantId: string): Promise<void>
  async getUsageHistory(tenantId: string, period: string): Promise<UsageReport>
  async canPerformAction(tenantId: string, cost: number): Promise<boolean>
}
```

**Dependencies:** Ticket 1.1, 1.2

---

## Phase 2: Customer Portal Integration

### Ticket 2.1: Stripe Customer Creation & Linking
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 3 story points

**Description:**
Implement automatic Stripe customer creation and linking when tenants access billing features.

**Acceptance Criteria:**
- [ ] Create middleware to check/create Stripe customer
- [ ] Add customer creation on first billing access
- [ ] Update tenant record with Stripe customer ID
- [ ] Handle customer creation errors gracefully
- [ ] Add logging for customer creation events
- [ ] Ensure idempotent customer creation
- [ ] Add tenant service methods for Stripe integration

**Technical Details:**
```typescript
// In TenantService
async ensureStripeCustomer(tenantId: string): Promise<string> {
  // Check if customer exists, create if not
  // Return customer ID
}
```

**Dependencies:** Ticket 1.2, 1.3

---

### Ticket 2.2: Billing Portal Route & API
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 3 story points

**Description:**
Create backend API endpoint to generate Stripe Customer Portal sessions for billing management.

**Acceptance Criteria:**
- [ ] Create `/api/billing/portal` POST endpoint
- [ ] Add proper authentication and tenant validation
- [ ] Generate Stripe Customer Portal session
- [ ] Return portal URL for frontend redirect
- [ ] Add proper error handling for portal creation failures
- [ ] Add request/response schemas with TypeBox
- [ ] Add endpoint documentation
- [ ] Add integration tests

**Technical Details:**
```typescript
// POST /api/billing/portal
{
  "returnUrl": "https://app.domain.com/settings/billing"
}

// Response:
{
  "portalUrl": "https://billing.stripe.com/session/xyz..."
}
```

**Dependencies:** Ticket 2.1

---

### Ticket 2.3: Frontend Billing Portal Integration
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 2 story points

**Description:**
Update the frontend billing page to redirect users to Stripe Customer Portal when billing tab is clicked.

**Acceptance Criteria:**
- [ ] Update `BillingPage.tsx` to call portal API
- [ ] Add loading state during portal session creation
- [ ] Handle portal creation errors with user-friendly messages
- [ ] Add proper error boundaries
- [ ] Update "Manage Billing" button to trigger portal redirect
- [ ] Add confirmation dialog before redirect (optional)
- [ ] Test portal flow end-to-end

**Technical Details:**
```typescript
const handleManageBilling = async () => {
  try {
    setLoading(true);
    const response = await billingService.createPortalSession();
    window.location.href = response.portalUrl;
  } catch (error) {
    showError('Failed to open billing portal');
  } finally {
    setLoading(false);
  }
};
```

**Dependencies:** Ticket 2.2

---

## Phase 3: Credit System Implementation

### Ticket 3.1: Credit Balance Display
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: Medium  
**Estimate**: 3 story points

**Description:**
Create UI components to display current credit balances and usage information on the billing page.

**Acceptance Criteria:**
- [ ] Create `CreditBalance` component showing subscription and bundle credits
- [ ] Add real-time credit balance fetching
- [ ] Display credit usage history and trends
- [ ] Add credit expiration information for subscriptions
- [ ] Show next billing cycle date
- [ ] Add loading and error states
- [ ] Make component responsive and accessible
- [ ] Add unit tests for component

**Technical Details:**
```typescript
interface CreditBalance {
  subscriptionCredits: number;
  bundleCredits: number;
  totalUsedThisMonth: number;
  nextResetDate: string;
  planName: string;
}
```

**Dependencies:** Ticket 1.3

---

### Ticket 3.2: Usage Tracking Middleware
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 4 story points

**Description:**
Implement middleware to track feature usage and automatically deduct credits for billable actions.

**Acceptance Criteria:**
- [ ] Create billing middleware for protected routes
- [ ] Define credit costs for different features/actions
- [ ] Implement automatic credit deduction on usage
- [ ] Add usage validation before action execution
- [ ] Log all usage events for audit trail
- [ ] Handle insufficient credit scenarios gracefully
- [ ] Add bypass mechanism for admin/testing
- [ ] Add comprehensive error handling

**Technical Details:**
```typescript
// Usage tracking decorator/middleware
@TrackUsage(cost: number, feature: string)
async function performAction() {
  // Action implementation
}

// Credit costs configuration
const CREDIT_COSTS = {
  SEND_EMAIL: 1,
  ANALYZE_LEAD: 2,
  GENERATE_CAMPAIGN: 5,
  // etc.
};
```

**Dependencies:** Ticket 1.3

---

### Ticket 3.3: Auto-Purchase Bundle Logic
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 5 story points

**Description:**
Implement automatic bundle credit purchasing when subscription credits are exhausted.

**Acceptance Criteria:**
- [ ] Create auto-purchase service with configurable thresholds
- [ ] Trigger bundle purchase when subscription credits < threshold
- [ ] Handle payment processing and confirmation
- [ ] Add credit allocation after successful purchase
- [ ] Implement fallback for failed auto-purchases
- [ ] Add user notifications for auto-purchases
- [ ] Create admin override controls
- [ ] Add comprehensive logging and monitoring
- [ ] Handle edge cases (payment failures, partial purchases)

**Technical Details:**
```typescript
class AutoPurchaseService {
  async checkAndPurchase(tenantId: string): Promise<boolean>
  async purchaseBundle(tenantId: string, bundleSize: number): Promise<PurchaseResult>
  async handlePurchaseFailure(tenantId: string, error: Error): Promise<void>
}
```

**Dependencies:** Ticket 1.2, 1.3, 3.2

---

## Phase 4: Webhooks & Real-Time Updates

### Ticket 4.1: Stripe Webhook Infrastructure
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 4 story points

**Description:**
Set up secure webhook endpoint infrastructure to receive and process Stripe events in real-time.

**Acceptance Criteria:**
- [ ] Create `/webhooks/stripe` POST endpoint
- [ ] Implement webhook signature verification
- [ ] Add webhook event logging and deduplication
- [ ] Create webhook event processing queue
- [ ] Add proper error handling and retry logic
- [ ] Implement idempotent event processing
- [ ] Add webhook testing utilities
- [ ] Add monitoring and alerting for webhook failures

**Technical Details:**
```typescript
// POST /webhooks/stripe
async function handleStripeWebhook(request: FastifyRequest) {
  const signature = request.headers['stripe-signature'];
  const payload = request.body;
  
  // Verify signature
  // Log event
  // Queue for processing
  // Return 200 OK
}
```

**Dependencies:** Ticket 1.2

---

### Ticket 4.2: Subscription Webhook Handlers
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 4 story points

**Description:**
Implement webhook handlers for subscription lifecycle events (created, updated, cancelled, renewed).

**Acceptance Criteria:**
- [ ] Handle `customer.subscription.created` events
- [ ] Handle `customer.subscription.updated` events
- [ ] Handle `customer.subscription.deleted` events
- [ ] Handle `invoice.payment_succeeded` events for renewals
- [ ] Update tenant billing status based on events
- [ ] Reset subscription credits on renewal
- [ ] Handle subscription plan changes
- [ ] Add comprehensive event logging

**Technical Details:**
```typescript
class SubscriptionWebhookHandler {
  async handleSubscriptionCreated(event: Stripe.Event): Promise<void>
  async handleSubscriptionUpdated(event: Stripe.Event): Promise<void>
  async handleSubscriptionCancelled(event: Stripe.Event): Promise<void>
  async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void>
}
```

**Dependencies:** Ticket 4.1

---

### Ticket 4.3: Payment Webhook Handlers
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 3 story points

**Description:**
Implement webhook handlers for payment events related to bundle credit purchases.

**Acceptance Criteria:**
- [ ] Handle `payment_intent.succeeded` events for bundle purchases
- [ ] Handle `payment_intent.payment_failed` events
- [ ] Allocate bundle credits on successful payment
- [ ] Handle refund events and credit adjustments
- [ ] Send user notifications for payment events
- [ ] Add transaction logging for all payment events
- [ ] Handle partial payments and disputes

**Technical Details:**
```typescript
class PaymentWebhookHandler {
  async handlePaymentSucceeded(event: Stripe.Event): Promise<void>
  async handlePaymentFailed(event: Stripe.Event): Promise<void>
  async handleRefund(event: Stripe.Event): Promise<void>
}
```

**Dependencies:** Ticket 4.1, 1.3

---

## Phase 5: Frontend & User Experience

### Ticket 5.1: Credit Usage Notifications
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: Medium  
**Estimate**: 3 story points

**Description:**
Implement user notifications for credit usage milestones and billing events.

**Acceptance Criteria:**
- [ ] Create notification system for credit thresholds (75%, 90%, 100%)
- [ ] Add notifications for auto-purchases
- [ ] Show notifications for subscription renewals
- [ ] Create dismissible notification components
- [ ] Add notification preferences in settings
- [ ] Implement email notifications for critical events
- [ ] Add notification history/log
- [ ] Test notification triggers and display

**Technical Details:**
```typescript
interface BillingNotification {
  type: 'credit_low' | 'auto_purchase' | 'renewal';
  message: string;
  severity: 'info' | 'warning' | 'error';
  actions?: NotificationAction[];
}
```

**Dependencies:** Ticket 3.1

---

### Ticket 5.2: Enhanced Billing Dashboard
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: Medium  
**Estimate**: 4 story points

**Description:**
Create comprehensive billing dashboard showing usage analytics, credit history, and billing management.

**Acceptance Criteria:**
- [ ] Create usage analytics charts (daily/monthly)
- [ ] Add credit purchase history
- [ ] Show subscription details and next billing date
- [ ] Add usage breakdown by feature
- [ ] Create credit usage forecasting
- [ ] Add export functionality for billing data
- [ ] Implement responsive design
- [ ] Add accessibility features

**Technical Details:**
```typescript
interface BillingDashboard {
  currentPeriod: BillingPeriod;
  usageAnalytics: UsageChart[];
  creditHistory: CreditTransaction[];
  upcomingBilling: BillingForecast;
}
```

**Dependencies:** Ticket 3.1, 5.1

---

### Ticket 5.3: Credit Purchase Flow (Optional)
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: Low  
**Estimate**: 5 story points

**Description:**
Add manual credit purchase flow for users who want to buy bundle credits proactively.

**Acceptance Criteria:**
- [ ] Create credit bundle selection UI
- [ ] Integrate with Stripe Checkout for payments
- [ ] Add purchase confirmation flow
- [ ] Handle payment success/failure states
- [ ] Add purchase receipt generation
- [ ] Implement purchase limits and validation
- [ ] Add gift credit functionality (admin)
- [ ] Test complete purchase flow

**Technical Details:**
```typescript
interface CreditBundle {
  id: string;
  name: string;
  credits: number;
  price: number;
  discount?: number;
}
```

**Dependencies:** Ticket 1.2, 5.2

---

## Phase 6: Testing & Quality Assurance

### Ticket 6.1: Webhook Testing Suite
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 3 story points

**Description:**
Create comprehensive testing suite for webhook event processing and edge cases.

**Acceptance Criteria:**
- [ ] Create webhook event mocking utilities
- [ ] Add tests for all webhook event types
- [ ] Test webhook signature verification
- [ ] Add tests for event deduplication
- [ ] Test error handling and retry logic
- [ ] Create webhook integration tests
- [ ] Add performance tests for webhook processing
- [ ] Document webhook testing procedures

**Dependencies:** Ticket 4.1, 4.2, 4.3

---

### Ticket 6.2: Billing Integration Tests
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: High  
**Estimate**: 4 story points

**Description:**
Create end-to-end integration tests for the complete billing and credit system.

**Acceptance Criteria:**
- [ ] Test complete user billing journey
- [ ] Add credit deduction and allocation tests
- [ ] Test auto-purchase flow end-to-end
- [ ] Add subscription lifecycle tests
- [ ] Test error scenarios and recovery
- [ ] Create load tests for billing operations
- [ ] Add data consistency validation tests
- [ ] Document test scenarios and procedures

**Dependencies:** All previous tickets

---

### Ticket 6.3: Monitoring & Alerting Setup
**Epic**: Stripe Integration for Product-Led Growth with Token-Based Billing  
**Priority**: Medium  
**Estimate**: 3 story points

**Description:**
Implement monitoring, logging, and alerting for the billing system to ensure reliability and quick issue detection.

**Acceptance Criteria:**
- [ ] Add billing operation logging with structured data
- [ ] Create dashboards for billing metrics
- [ ] Set up alerts for webhook failures
- [ ] Add monitoring for credit balance anomalies
- [ ] Create alerts for auto-purchase failures
- [ ] Add performance monitoring for billing operations
- [ ] Set up error tracking and reporting
- [ ] Document monitoring procedures

**Dependencies:** All previous tickets

---

## Implementation Timeline

### Sprint 1 (2 weeks): Foundation
- Tickets 1.1, 1.2, 1.3

### Sprint 2 (2 weeks): Portal Integration  
- Tickets 2.1, 2.2, 2.3

### Sprint 3 (2 weeks): Credit System
- Tickets 3.1, 3.2, 3.3

### Sprint 4 (2 weeks): Webhooks
- Tickets 4.1, 4.2, 4.3

### Sprint 5 (2 weeks): UX & Frontend
- Tickets 5.1, 5.2, (5.3 optional)

### Sprint 6 (1 week): Testing & QA
- Tickets 6.1, 6.2, 6.3

**Total Estimated Duration**: 11 weeks  
**Total Story Points**: 67 points

---

## Risk Assessment & Mitigation

### High Risks
1. **Webhook Reliability**: Implement robust retry logic and monitoring
2. **Credit Calculation Accuracy**: Add comprehensive testing and validation
3. **Payment Processing Failures**: Implement fallback mechanisms and user notifications
4. **Data Consistency**: Use database transactions and implement reconciliation processes

### Medium Risks
1. **Stripe API Rate Limits**: Implement proper rate limiting and queuing
2. **User Experience**: Conduct thorough UX testing and gather feedback
3. **Security**: Regular security audits and penetration testing

---

## Success Metrics

### Technical Metrics
- Webhook processing success rate > 99.9%
- Credit calculation accuracy 100%
- Billing page load time < 2 seconds
- Auto-purchase success rate > 95%

### Business Metrics
- User billing portal engagement
- Credit usage patterns and optimization
- Revenue attribution from auto-purchases
- Customer satisfaction with billing experience

---

## Post-Launch Considerations

1. **Analytics Integration**: Add billing analytics to business intelligence systems
2. **Advanced Features**: Usage-based pricing, custom billing cycles, enterprise plans
3. **Optimization**: Credit bundling strategies, pricing optimization
4. **Compliance**: SOC2, GDPR compliance for billing data
5. **Scaling**: Multi-region billing, currency support
