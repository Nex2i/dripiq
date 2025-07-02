# SEQ Logging Integration

This server includes integration with [SEQ](https://datalust.co/seq) for structured logging in non-production environments.

## What is SEQ?

SEQ is a structured logging server that helps you search, filter, and analyze log data from your applications. It provides a web-based interface for viewing logs with powerful search capabilities.

## Configuration

SEQ logging is **only enabled in non-production environments** (`NODE_ENV !== 'production'`) for security and performance reasons.

### Environment Variables

Add the following environment variables to enable SEQ logging:

```env
# SEQ Configuration (required for SEQ integration)
SEQ_SERVER_URL=http://localhost:5341
SEQ_API_KEY=your_seq_api_key_here  # Optional: only if authentication is required
```

### Setting up SEQ locally

1. **Docker (Recommended)**:
   ```bash
   docker run --name seq -d --restart unless-stopped -e ACCEPT_EULA=Y -p 5341:80 datalust/seq:latest
   ```

2. **Direct Installation**: Download from https://datalust.co/seq

3. **Access the UI**: Navigate to `http://localhost:5341` in your browser

## Log Structure

All logs sent to SEQ include the following metadata:

- `environment`: The current NODE_ENV value
- `application`: "promptdepot-server"
- `version`: Application version from package.json
- `timestamp`: ISO 8601 timestamp
- `level`: Log level (error, warn, info, debug)
- `message`: The log message
- `payload`: Any additional data passed to the logger

## Usage

The logger continues to work exactly as before, but now logs will also be sent to SEQ when configured:

```typescript
import { logger } from '@/libs/logger';

// Simple message
logger.info('User logged in');

// With additional data
logger.info('User logged in', { userId: '123', email: 'user@example.com' });

// Error logging
logger.error('Database connection failed', { error: dbError });
```

## SEQ Queries

Here are some useful SEQ query examples:

- **All errors**: `@Level = 'error'`
- **Specific user events**: `payload.userId = '123'`
- **Database-related logs**: `@Message like '%database%'`
- **Last hour**: `@Timestamp > Now() - 1h`

## Troubleshooting

- Logs appear in console but not in SEQ: Check that `SEQ_SERVER_URL` is set and SEQ is running
- Connection errors: Verify SEQ is accessible at the configured URL
- Authentication issues: Ensure `SEQ_API_KEY` is correct if SEQ requires authentication

## Production Considerations

- SEQ logging is **automatically disabled** in production environments
- Console logging remains available in all environments
- Consider log retention policies for SEQ in staging/development environments