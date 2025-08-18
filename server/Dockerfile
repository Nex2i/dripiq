# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary config files
COPY drizzle.config.ts ./
COPY --from=builder /app/node_modules/.bin/drizzle-kit ./node_modules/.bin/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S server -u 1001

# Change ownership of the app directory
RUN chown -R server:nodejs /app
USER server

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/ping', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["dumb-init", "node", "dist/index.js"]