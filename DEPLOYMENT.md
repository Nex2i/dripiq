# Deployment Guide

This guide covers deploying the DripIQ application using Docker containers to various hosted services.

## Overview

The application consists of:
- **Client**: React/Vite frontend served by Nginx
- **Server**: Fastify backend with TypeScript
- **Worker**: Background job processor
- **PostgreSQL**: Database
- **Redis**: Cache and job queue

## Docker Images

After every commit to `main`/`master`, GitHub Actions automatically builds and pushes Docker images:

- `your-username/dripiq-client:latest` - Frontend application
- `your-username/dripiq-server:latest` - Backend application

Images are also tagged with:
- Branch name (e.g., `main`)
- Commit SHA (e.g., `main-abc1234`)

## Prerequisites

### 1. Docker Hub Setup

1. Create a Docker Hub account
2. Add these secrets to your GitHub repository:
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub password or access token

### 2. Environment Variables

The application requires these environment variables:

#### Server Environment Variables
```bash
# Database
DATABASE_URL=postgresql://username:password@host:5432/database_name

# Redis
REDIS_URL=redis://host:6379

# Application
NODE_ENV=production
PORT=8080

# JWT (generate a secure random string)
JWT_SECRET=your-jwt-secret-here

# SendGrid (for email)
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=your-from-email@domain.com

# OpenAI (if using AI features)
OPENAI_API_KEY=your-openai-api-key

# Supabase (if using Supabase features)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Client Environment Variables
```bash
# API endpoint
VITE_API_URL=https://your-api-domain.com

# Supabase (if using client-side Supabase)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Deployment Options

### Option 1: Railway

Railway is ideal for full-stack applications with databases.

1. **Connect Repository**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and connect
   railway login
   railway link
   ```

2. **Deploy Services**
   ```bash
   # Deploy all services
   railway up --detach
   ```

3. **Configure Environment**
   - Add environment variables in Railway dashboard
   - Set up custom domains

### Option 2: Render

Render provides managed PostgreSQL and Redis services.

1. **Create Services**
   - Create PostgreSQL database
   - Create Redis instance
   - Create Web Service for server
   - Create Static Site for client

2. **Configuration**
   ```yaml
   # render.yaml
   services:
     - type: web
       name: dripiq-server
       env: docker
       dockerfilePath: ./server/Dockerfile
       envVars:
         - key: DATABASE_URL
           fromDatabase:
             name: dripiq-db
             property: connectionString
         - key: REDIS_URL
           fromService:
             name: dripiq-redis
             type: redis
             property: connectionString
   
     - type: static
       name: dripiq-client
       buildCommand: docker build -f ./client/Dockerfile -t client ./client && docker run --rm -v $(pwd)/dist:/output client cp -r /usr/share/nginx/html/. /output/
       publishPath: ./dist
   
   databases:
     - name: dripiq-db
       databaseName: dripiq
       user: dripiq
   ```

### Option 3: DigitalOcean App Platform

1. **Create App**
   ```yaml
   # .do/app.yaml
   name: dripiq
   services:
   - name: server
     source_dir: /server
     dockerfile_path: server/Dockerfile
     instance_count: 1
     instance_size_slug: basic-xxs
     http_port: 8080
     environment_slug: node-js
     envs:
     - key: DATABASE_URL
       value: ${db.DATABASE_URL}
     - key: REDIS_URL
       value: ${redis.REDIS_URL}
   
   - name: client
     source_dir: /client
     dockerfile_path: client/Dockerfile
     instance_count: 1
     instance_size_slug: basic-xxs
     http_port: 80
   
   databases:
   - name: db
     engine: PG
     version: "15"
   ```

### Option 4: AWS ECS with Fargate

1. **Create ECR Repositories**
   ```bash
   aws ecr create-repository --repository-name dripiq-client
   aws ecr create-repository --repository-name dripiq-server
   ```

2. **Update CI to Push to ECR**
   ```yaml
   # Add to .github/workflows/ci.yml
   - name: Configure AWS credentials
     uses: aws-actions/configure-aws-credentials@v4
     with:
       aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
       aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
       aws-region: us-east-1
   
   - name: Login to Amazon ECR
     uses: aws-actions/amazon-ecr-login@v2
   ```

3. **Deploy with ECS**
   - Create ECS cluster
   - Create task definitions
   - Set up Application Load Balancer
   - Configure RDS and ElastiCache

### Option 5: Google Cloud Run

1. **Enable APIs**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

2. **Deploy Services**
   ```bash
   # Deploy server
   gcloud run deploy dripiq-server \
     --source ./server \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   
   # Deploy client
   gcloud run deploy dripiq-client \
     --source ./client \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

## Local Development with Docker

### Development Environment
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Access services
# Client: http://localhost:3000
# Server: http://localhost:8080
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

### Production Environment (Local)
```bash
# Build and start production environment
docker-compose up --build

# Access services
# Client: http://localhost:80
# Server: http://localhost:8080
```

## Health Checks and Monitoring

### Health Endpoints
- Server: `GET /health`
- Client: Nginx status

### Monitoring Setup
```yaml
# Add to docker-compose.yml for monitoring
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   docker exec -it <server-container> node -e "
   const { Client } = require('pg');
   const client = new Client(process.env.DATABASE_URL);
   client.connect().then(() => console.log('Connected')).catch(console.error);
   "
   ```

2. **Redis Connection Issues**
   ```bash
   # Check Redis connectivity
   docker exec -it <server-container> node -e "
   const Redis = require('ioredis');
   const redis = new Redis(process.env.REDIS_URL);
   redis.ping().then(console.log).catch(console.error);
   "
   ```

3. **Build Failures**
   ```bash
   # Clear Docker build cache
   docker builder prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

### Logs
```bash
# View logs
docker-compose logs -f server
docker-compose logs -f client
docker-compose logs -f worker

# View specific container logs
docker logs <container-id> -f
```

## Security Considerations

1. **Environment Variables**: Never commit sensitive environment variables
2. **HTTPS**: Always use HTTPS in production
3. **Database Security**: Use strong passwords and restrict access
4. **Container Security**: Keep base images updated
5. **Network Security**: Use private networks where possible

## Scaling

### Horizontal Scaling
```yaml
# Scale services
services:
  server:
    deploy:
      replicas: 3
  
  worker:
    deploy:
      replicas: 2
```

### Load Balancing
- Use a load balancer (ALB, NGINX, Cloudflare)
- Configure session affinity if needed
- Monitor resource usage

## Backup and Recovery

### Database Backups
```bash
# Backup PostgreSQL
docker exec <postgres-container> pg_dump -U postgres dripiq > backup.sql

# Restore PostgreSQL
docker exec -i <postgres-container> psql -U postgres dripiq < backup.sql
```

### Volume Backups
```bash
# Backup volumes
docker run --rm -v dripiq_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Next Steps

1. Set up your chosen hosting platform
2. Configure environment variables
3. Set up monitoring and alerting
4. Configure automated backups
5. Set up a custom domain
6. Configure SSL certificates
7. Set up log aggregation