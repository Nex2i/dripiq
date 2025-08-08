# Outreach Campaign Implementation Guide

This directory contains detailed implementation tickets for building a production-ready, AI-personalized outreach campaign system. The system uses SQL as the source of truth, BullMQ for orchestration, and SendGrid for email delivery.

## Quick Start

1. **Review Architecture**: Start with `../outreach-campaign-architecture.md`
2. **Check Overview**: Read `00-overview.md` for phases and dependencies
3. **Follow Order**: Implement tickets in numbered order within each phase
4. **Test Incrementally**: Testing can be added later; unit tests are not required yet

## Implementation Tickets

### Phase 1: Foundation (Tickets 01-04)
Core infrastructure and database setup.

- **[01-database-schema.md](./01-database-schema.md)** - Create all 13 new tables with relationships
- **[02-bullmq-setup.md](./02-bullmq-setup.md)** - Redis and BullMQ infrastructure with job queues
- **[03-sendgrid-integration.md](./03-sendgrid-integration.md)** - SendGrid client and email validation API
- **[04-sender-identities.md](./04-sender-identities.md)** - Per-AE sender identity management

### Phase 2: Core Campaign Engine (Tickets 05-08)
Campaign execution and scheduling system.

- **[05-campaign-plans.md](./05-campaign-plans.md)** - JSON campaign plan storage and versioning
- **06-scheduled-actions.md** - SQL-based action scheduling system
- **[07-send-worker.md](./07-send-worker.md)** - Core email sending with rate limiting and idempotency
- **08-timeout-worker.md** - Synthetic event generation for timeouts

### Phase 3: Event Processing (Tickets 09-11)
Webhook ingestion and reactive campaign logic.

- **[09-webhook-ingestion.md](./09-webhook-ingestion.md)** - SendGrid webhook processing with idempotency
- **10-message-events.md** - Event normalization and storage
- **[11-campaign-transitions.md](./11-campaign-transitions.md)** - Reactive state machine for campaign progression

### Phase 4: Analytics & Monitoring (Tickets 12-14)
Metrics, compliance, and admin controls.

- **12-analytics-aggregation.md** - Materialized views and rollup tables
- **13-suppression-management.md** - Unsubscribe and bounce handling
- **14-admin-controls.md** - Tenant controls and campaign management

### Phase 5: Scaling & Extensions (Tickets 15-17)
Performance optimizations and future extensions.

- **15-partitioning-indexes.md** - Database optimization for scale
- **16-reply-handling.md** - Inbound message processing
- **17-sms-foundation.md** - Prepare schema and workers for SMS

## Critical Path for MVP

**Minimum Viable Product**: Tickets 01-11

These tickets provide:
- ✅ Database schema and BullMQ infrastructure
- ✅ Campaign plan storage and execution
- ✅ Email sending with rate limiting and idempotency
- ✅ Webhook ingestion and event processing
- ✅ Reactive campaign state machine

**Post-MVP**: Tickets 12-17 can be implemented in parallel or after launch.

## Key Design Principles

### SQL as Source of Truth
- All campaign state stored in PostgreSQL
- BullMQ jobs are ephemeral; SQL provides durability
- Rebuild capability from SQL if Redis is lost

### Idempotency Everywhere
- Unique dedupe keys prevent duplicate sends
- Webhook payload hashes prevent double processing
- Retry-safe workers with constraint-based deduplication

### Multi-Level Rate Limiting
- Per-sender (AE): 20/min, 1,000/hour
- Per-tenant: 5,000/hour
- Global: 20,000/hour
- Per-domain: 200/hour (gmail.com, etc.)

### Event-Driven Architecture
- SendGrid webhooks feed real-time events
- Campaigns react to opens, clicks, bounces automatically
- Timeout workers generate synthetic events (no-open, no-click)

## Technology Stack

### Backend
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **Queue**: Redis + BullMQ for job orchestration
- **Email**: SendGrid with dedicated IPs
- **API**: Fastify with TypeScript

### Key Libraries
```json
{
  "bullmq": "^4.x",
  "ioredis": "^5.x", 
  "@sendgrid/mail": "^7.x",
  "drizzle-orm": "^0.28.x",
  "@paralleldrive/cuid2": "^2.x"
}
```

## Environment Setup

### Required Environment Variables
```bash
# Database
DB_HOST=your-supabase-host
DB_PASSWORD=your-db-password

# Redis  
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# SendGrid
SENDGRID_API_KEY=your-api-key
SENDGRID_WEBHOOK_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# BullMQ
BULLMQ_ADMIN_PASSWORD=secure-password
```

### Development Setup
```bash
# Install dependencies
cd server && npm install

# Run migrations
npm run db:migrate

# Start Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Start workers
npm run workers:start

# Start API server
npm run dev
```

## Testing Strategy

- Unit tests are not required at this stage. Focus on end-to-end verification in staging and manual checks for critical flows.
- Load testing and monitoring will be introduced post-MVP.

## Monitoring & Observability

### Key Metrics
- **Send Success Rate**: >99% for verified emails
- **Event Processing Latency**: <100ms p95
- **Queue Depth**: <1000 pending jobs during normal operation
- **Rate Limit Hits**: <1% of send attempts

### Alerting
- Failed jobs exceed threshold
- Webhook processing delays
- High bounce/spam rates
- Database query performance degradation

## Security Considerations

### Email Security
- Sender identity verification required
- Suppression list enforcement
- Rate limiting prevents abuse
- Webhook signature validation

### Data Protection
- PII handling in compliance with regulations
- Audit trails for all campaign actions
- Secure API key storage and rotation
- Input validation and sanitization

## Scaling Guidance

### Database Scaling
- Partition `message_events` by month
- Add read replicas for analytics queries
- Connection pooling for worker processes

### Queue Scaling
- Horizontal worker scaling with Redis Cluster
- Per-tenant queue isolation for large customers
- Job priority management

### Email Deliverability
- IP warming schedule for dedicated IPs
- Domain authentication (SPF, DKIM, DMARC)
- Feedback loop monitoring
- Gradual volume increases

## Rollback Strategy

### Phase-by-Phase Rollback
1. **Database Issues**: Each migration is reversible
2. **Worker Problems**: Stop workers, process jobs manually
3. **Email Issues**: Pause sending, investigate deliverability
4. **Performance Issues**: Scale resources, adjust rate limits

### Data Recovery
- Full webhook payload retention for reprocessing
- Campaign state rebuilding from audit logs
- Message status reconciliation with SendGrid

## Support & Maintenance

### Operational Runbooks
- Worker restart procedures
- Database maintenance windows
- SendGrid configuration changes
- Rate limit adjustments

### Troubleshooting
- Common error patterns and solutions
- Performance debugging guides
- Queue management commands
- Database query optimization

## Next Steps

After completing the core implementation (Tickets 01-11):

1. **Analytics Dashboard**: Implement real-time metrics (Ticket 12)
2. **Admin Controls**: Build tenant management interface (Ticket 14)
3. **Performance Optimization**: Database partitioning and indexes (Ticket 15)
4. **SMS Extension**: Prepare for multi-channel expansion (Ticket 17)

## Contributing

### Code Standards
- TypeScript strict mode
- Comprehensive error handling
- Detailed logging with structured data
- Unit test coverage >90%

### Review Process
- Each ticket requires code review
- Integration tests must pass
- Performance impact assessment
- Security review for user-facing changes

---

For questions or clarification on any ticket, refer to the main architecture document or create an issue for discussion.