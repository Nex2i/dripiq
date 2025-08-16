# Bull-Board Dashboard

This project includes [Bull-Board](https://github.com/felixmosh/bull-board), a powerful dashboard for monitoring and managing BullMQ queues.

## Features

- Real-time monitoring of queue jobs
- Job details and logs viewing
- Job management (retry, delete, etc.)
- Queue statistics and metrics
- Secure access with basic authentication

## Access

The Bull-Board dashboard is available at:
```
http://localhost:8085/admin/queues
```

## Authentication

The dashboard is protected with basic authentication. Default credentials:
- **Username**: `admin`
- **Password**: `admin123`

You can customize these credentials by setting environment variables:
```env
BULL_BOARD_USERNAME=your_username
BULL_BOARD_PASSWORD=your_secure_password
```

## Monitored Queues

The dashboard monitors the following queues:
- `lead_analysis` - Lead analysis processing jobs
- `campaign_creation` - Campaign creation jobs

## Environment Configuration

Add these environment variables to your `.env` file:

```env
# Bull-Board Dashboard
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=admin123
```

## Production Considerations

⚠️ **Important**: In production environments:
1. Change the default credentials to secure values
2. Consider restricting access by IP or using more sophisticated authentication
3. Use HTTPS for secure communication
4. Monitor dashboard access in your logs

## Development Usage

1. Start your server with `npm run dev` or `npm run dev:both`
2. Navigate to `http://localhost:8085/admin/queues`
3. Enter your credentials when prompted
4. Monitor your queues in real-time

## Features Available

- **Queue Overview**: See all queues and their current status
- **Job Details**: Click on any job to see its data, progress, and logs
- **Job Management**: Retry failed jobs, remove completed jobs, or pause/resume queues
- **Real-time Updates**: The dashboard updates automatically as jobs are processed
- **Search and Filter**: Find specific jobs using various filters

## Troubleshooting

If you can't access the dashboard:
1. Ensure the server is running
2. Check that Redis is connected (required for BullMQ)
3. Verify your credentials
4. Check the server logs for any plugin initialization errors