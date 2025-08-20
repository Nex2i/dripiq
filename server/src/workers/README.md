# Workers

This directory contains all BullMQ workers for background job processing.

## Structure

```
workers/
├── worker.run.ts                               # Central worker runner
├── index.ts                                    # Barrel exports
├── campaign-creation/
│   └── campaign-creation.worker.ts            # Campaign creation worker
├── lead-analysis/
│   └── lead-analysis.worker.ts                # Lead analysis worker
└── messages/
    └── messages.worker.ts                      # Messages worker (demo/test)
```

## Running Workers

### Development

```bash
npm run dev:workers        # Start all workers in development mode
npm run dev:both          # Start server + workers concurrently
```

### Production

```bash
npm run workers           # Start all workers in production mode
npm run start:both        # Start server + workers concurrently
```

### Direct execution

```bash
tsx src/workers/worker.run.ts     # Run workers directly
node dist/workers/worker.run.js   # Run compiled workers
```

## Worker Configuration

Global worker settings are configured in `@/libs/bullmq.ts`:

- **Lock Duration**: 5 minutes (for long-running AI tasks)
- **Lock Renewal**: 2.5 minutes
- **Max Stalled Count**: 2 attempts
- **Default Concurrency**: 5 workers

Individual workers can override these settings in their options.

## Workers

### Campaign Creation Worker

- **Queue**: `campaign_creation`
- **Concurrency**: 3 (default global settings)
- **Purpose**: Processes AI-powered campaign creation for contacts
- **Dependencies**: OpenAI, contact strategy service

### Lead Analysis Worker

- **Queue**: `lead_analysis`
- **Concurrency**: 2
- **Purpose**: Analyzes leads and automatically creates campaign jobs
- **Dependencies**: Firecrawl, site analysis, contact extraction

### Messages Worker

- **Queue**: `messages`
- **Concurrency**: 5 (default global settings)
- **Purpose**: Test/demo worker for basic message processing
- **Status**: Demo only, can be removed

## Monitoring

Workers emit events that are monitored by the `queues.plugin.ts`:

- Job completion/failure logging
- Queue event listeners
- Graceful shutdown handling

## Adding New Workers

1. Create new directory: `src/workers/my-worker/`
2. Create worker file: `my-worker.worker.ts`
3. Add to `workers/index.ts` exports
4. Import in `worker.run.ts`
5. Add to `queues.plugin.ts` for monitoring

## Environment Variables

Workers use the same environment configuration as the main server:

- `REDIS_URL` - Redis connection for BullMQ
- `DATABASE_URL` - Database connection
- `OPENAI_API_KEY` - For AI-powered workers
- `FIRECRAWL_API_KEY` - For web scraping workers
