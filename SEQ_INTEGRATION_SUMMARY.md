# SEQ Logging Integration - Implementation Summary

## Overview

Successfully integrated SEQ (https://datalust.co/seq) structured logging for the PromptDepot server. The integration is **automatically disabled in production environments** for security and performance reasons.

## What Was Implemented

### 1. Dependencies
- **Added**: `pino-seq` package for SEQ transport integration with Pino logger

### 2. Environment Configuration
- **Updated**: `server/src/utils/validateEnv.ts` - Added optional SEQ configuration validation
- **Updated**: `server/src/config/index.ts` - Exported SEQ environment variables
- **Updated**: `server/.example.env` - Added SEQ configuration examples

### 3. Logger Enhancement
- **Updated**: `server/src/libs/logger.ts` - Enhanced to support multiple transports
  - Maintains existing console logging with pino-pretty
  - Conditionally adds SEQ transport for non-production environments
  - Includes application metadata (environment, application name, version)
  - Error handling for SEQ connection issues

### 4. Startup Monitoring
- **Updated**: `server/src/index.ts` - Added SEQ configuration status logging
  - Reports whether SEQ is enabled/disabled and why
  - Helps troubleshoot configuration issues

### 5. Documentation
- **Created**: `server/docs/SEQ_LOGGING.md` - Comprehensive setup and usage guide

## Environment Variables

Add these to your `.env` file to enable SEQ logging:

```env
# SEQ Configuration (for non-production environments only)
SEQ_SERVER_URL=http://localhost:5341
SEQ_API_KEY=your_seq_api_key_here  # Optional
```

## Key Features

### ✅ Production Safety
- **Automatically disabled** when `NODE_ENV=production`
- No performance impact in production
- Console logging remains available in all environments

### ✅ Rich Metadata
Every log entry includes:
- Environment name
- Application name and version
- Structured payload data
- Timestamp and log level

### ✅ Error Resilience
- SEQ connection failures don't break application logging
- Warnings logged to console for troubleshooting
- Graceful fallback to console-only logging

### ✅ Easy Setup
- Optional configuration (works without SEQ)
- Clear documentation and examples
- Docker command provided for local SEQ setup

## Usage

The existing logger API remains unchanged:

```typescript
import { logger } from '@/libs/logger';

logger.info('User action', { userId: '123', action: 'login' });
logger.error('Database error', { error: dbError, query: 'SELECT ...' });
```

## Quick Start with SEQ

1. **Start SEQ locally**:
   ```bash
   docker run --name seq -d --restart unless-stopped -e ACCEPT_EULA=Y -p 5341:80 datalust/seq:latest
   ```

2. **Configure environment**:
   ```env
   SEQ_SERVER_URL=http://localhost:5341
   NODE_ENV=development  # or local, staging - anything except production
   ```

3. **Start the server**:
   ```bash
   npm run dev
   ```

4. **Access SEQ UI**: http://localhost:5341

## Verification

The server will log its SEQ configuration status on startup:
- ✅ "SEQ logging enabled" - SEQ is configured and available
- ⚠️ "SEQ logging disabled - no SEQ_SERVER_URL configured" - SEQ not configured
- 🔒 "SEQ logging disabled - production environment" - Production mode

## Files Modified

1. `server/package.json` - Added pino-seq dependency
2. `server/src/utils/validateEnv.ts` - SEQ environment validation
3. `server/src/config/index.ts` - SEQ environment exports
4. `server/src/libs/logger.ts` - Logger transport configuration
5. `server/src/index.ts` - Startup SEQ status logging
6. `server/.example.env` - SEQ configuration examples
7. `server/docs/SEQ_LOGGING.md` - Complete documentation

## Testing

- ✅ TypeScript compilation successful
- ✅ Build process completes without errors
- ✅ Logger maintains backward compatibility
- ✅ Production environment safety verified