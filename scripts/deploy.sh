#!/bin/bash

# Deployment script for DripIQ application
# Usage: ./scripts/deploy.sh [environment]
# Environment: dev, staging, production

set -e

ENVIRONMENT=${1:-production}
DOCKER_USERNAME=${DOCKER_USERNAME:-""}

if [ -z "$DOCKER_USERNAME" ]; then
    echo "Error: DOCKER_USERNAME environment variable is required"
    exit 1
fi

echo "🚀 Deploying DripIQ to $ENVIRONMENT environment..."

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
    export $(cat .env.$ENVIRONMENT | xargs)
    echo "✅ Loaded environment variables from .env.$ENVIRONMENT"
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required tools
if ! command_exists docker; then
    echo "❌ Docker is required but not installed"
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is required but not installed"
    exit 1
fi

echo "✅ Required tools are installed"

# Determine compose file
COMPOSE_FILE="docker-compose.yml"
if [ "$ENVIRONMENT" = "dev" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
fi

echo "📦 Using compose file: $COMPOSE_FILE"

# Pull latest images if not in dev mode
if [ "$ENVIRONMENT" != "dev" ]; then
    echo "🔄 Pulling latest Docker images..."
    docker pull $DOCKER_USERNAME/dripiq-client:latest || echo "⚠️  Could not pull client image, will build locally"
    docker pull $DOCKER_USERNAME/dripiq-server:latest || echo "⚠️  Could not pull server image, will build locally"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

# Start services
echo "🏁 Starting services..."
if [ "$ENVIRONMENT" = "dev" ]; then
    docker-compose -f $COMPOSE_FILE up --build -d
else
    docker-compose -f $COMPOSE_FILE up -d
fi

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check if client is responding
if curl -f http://localhost:80 >/dev/null 2>&1; then
    echo "✅ Client is healthy"
else
    echo "❌ Client health check failed"
fi

# Check if server is responding
if curl -f http://localhost:8080/ping >/dev/null 2>&1; then
    echo "✅ Server is healthy"
else
    echo "❌ Server health check failed"
fi

# Show running containers
echo "📋 Running containers:"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🌐 Access your application:"
echo "   Client: http://localhost:80"
echo "   Server: http://localhost:8080"
echo "   Server Health: http://localhost:8080/ping"
echo ""
echo "📊 View logs:"
echo "   docker-compose -f $COMPOSE_FILE logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose -f $COMPOSE_FILE down"