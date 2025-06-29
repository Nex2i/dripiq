# PromptDepot Backend (`pd-server`)

**High-Performance API Server for LLM Prompt Management**

The backend of PromptDepot is a robust, scalable API server built with Fastify and TypeScript. It provides a comprehensive REST API for managing prompts, projects, users, and organizations with advanced features like multi-tenancy, role-based access control, and real-time collaboration.

## 🚀 Features

- **⚡ High Performance**: Built on Fastify for maximum throughput
- **🏢 Multi-tenant Architecture**: Support for multiple organizations
- **🔐 Advanced Authentication**: JWT + Supabase integration
- **📊 Database Management**: PostgreSQL with Prisma ORM
- **📝 API Documentation**: Auto-generated Swagger/OpenAPI docs
- **🔄 Real-time Features**: Socket.IO integration for live collaboration
- **🛡️ Security**: Comprehensive security middleware and validation
- **🧪 Testing Ready**: Jest testing framework integration

## 🏗️ Architecture

```
pd-server/
├── prisma/                 # Database schema and migrations
│   ├── migrations/         # Database migration files
│   └── schema.prisma      # Prisma schema definition
├── src/
│   ├── config/            # Application configuration
│   ├── constants/         # Application constants
│   ├── exceptions/        # Custom exception classes
│   ├── extensions/        # Prisma and other extensions
│   ├── libs/              # Utility libraries
│   ├── modules/           # Business logic modules
│   ├── plugins/           # Fastify plugins
│   ├── routes/            # API route definitions
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── app.ts            # Fastify app configuration
│   └── index.ts          # Application entry point
├── package.json
├── tsconfig.json
├── nodemon.json
└── README.md            # This file
```

## 🛠️ Tech Stack

### Core Framework
- **Fastify**: High-performance web framework
- **TypeScript**: Type-safe development
- **Node.js**: JavaScript runtime

### Database & ORM
- **PostgreSQL**: Primary database
- **Prisma**: Modern ORM with type safety
- **Prisma Accelerate**: Connection pooling and caching

### Authentication & Security
- **Supabase**: Authentication provider
- **JWT**: JSON Web Token authentication
- **Bcrypt**: Password hashing
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing

### Development & Testing
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Nodemon**: Development server with hot reload
- **TypeScript Compiler**: Type checking and compilation

### Documentation & API
- **Swagger/OpenAPI**: API documentation
- **TypeBox**: Runtime type validation
- **Pino**: High-performance logging

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- Supabase account (for authentication)

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd pd-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env` file in the `pd-server` directory:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/promptdepot"
   
   # Supabase Authentication
   SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_ANON_KEY="your-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   
   # JWT Configuration
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRE_TIME="7d"
   
   # Server Configuration
   PORT=3000
   NODE_ENV="development"
   CREDENTIALS="true"
   ORIGIN="http://localhost:5173"
   
   # Humanloop Integration (Optional)
   HUMANLOOP_API_KEY="your-humanloop-api-key"
   ```

4. **Database Setup:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate
   
   # Seed the database (optional)
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Verify the installation:**
   - API Server: http://localhost:3000
   - API Documentation: http://localhost:3000/documentation

## 📊 Database Schema

### Core Entities

#### Users
```prisma
model User {
  id         String   @id @default(cuid())
  supabaseId String   @unique
  email      String   @unique
  name       String?
  avatar     String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

#### Tenants (Organizations)
```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Projects
```prisma
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  tenantId    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Directories (Hierarchical Structure)
```prisma
model Directory {
  id          String   @id @default(cuid())
  name        String
  description String?
  isRoot      Boolean  @default(false)
  projectId   String
  parentId    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Prompts
```prisma
model Prompt {
  id          String   @id @default(cuid())
  name        String
  content     String
  description String?
  directoryId String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Relationship Models

- **UserTenant**: Many-to-many relationship between users and tenants
- **ProjectUser**: Many-to-many relationship with permissions for project access

## 🛣️ API Routes

### Authentication Routes
```
POST   /api/auth/login          # User login
POST   /api/auth/register       # User registration
POST   /api/auth/refresh        # Token refresh
POST   /api/auth/logout         # User logout
```

### User Management
```
GET    /api/users              # Get all users (admin)
GET    /api/users/:id          # Get user by ID
PUT    /api/users/:id          # Update user
DELETE /api/users/:id          # Delete user
```

### Tenant Management
```
GET    /api/tenants            # Get user's tenants
POST   /api/tenants            # Create new tenant
GET    /api/tenants/:id        # Get tenant details
PUT    /api/tenants/:id        # Update tenant
DELETE /api/tenants/:id        # Delete tenant
```

### Project Management
```
GET    /api/projects           # Get tenant's projects
POST   /api/projects           # Create new project
GET    /api/projects/:id       # Get project details
PUT    /api/projects/:id       # Update project
DELETE /api/projects/:id       # Delete project
```

### Directory Management
```
GET    /api/directories        # Get project directories
POST   /api/directories        # Create new directory
GET    /api/directories/:id    # Get directory details
PUT    /api/directories/:id    # Update directory
DELETE /api/directories/:id    # Delete directory
```

### Prompt Management
```
GET    /api/prompts            # Get directory prompts
POST   /api/prompts            # Create new prompt
GET    /api/prompts/:id        # Get prompt details
PUT    /api/prompts/:id        # Update prompt
DELETE /api/prompts/:id        # Delete prompt
```

## 🔐 Authentication & Authorization

### Authentication Flow
1. **User Registration/Login**: Via Supabase Auth
2. **JWT Token Generation**: Server generates JWT with user claims
3. **Token Validation**: Middleware validates JWT on protected routes
4. **User Context**: Extracted user info available in route handlers

### Permission System
```typescript
enum ProjectPermission {
  VIEW              // Read-only access
  EDIT              // Create/update content
  DELETE            // Delete content
  MANAGE_USERS      // Manage project users
  MANAGE_SETTINGS   // Manage project settings
}
```

### Route Protection
```typescript
// Example protected route
app.register(async function (app) {
  app.addHook('preHandler', app.authenticate)
  
  app.get('/protected-endpoint', async (request, reply) => {
    // User is authenticated
    const userId = request.user.id
    // Route logic here
  })
})
```

## 🧪 Development Scripts

```bash
# Development with hot reload
npm run dev

# Development server (build + start)
npm run dev:server

# Production build
npm run build

# Start production server
npm start

# Database operations
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Run migrations
npm run db:migrate:new  # Create new migration
npm run db:seed         # Seed database
npm run db:deploy       # Deploy migrations (production)

# Testing
npm test               # Run tests
npm run test:watch     # Run tests in watch mode

# Code quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
```

## 🔌 Plugins & Middleware

### Core Plugins
- **Authentication Plugin**: JWT validation and user context
- **Database Plugin**: Prisma client integration
- **Validation Plugin**: Request/response validation with TypeBox
- **Error Handling Plugin**: Centralized error management

### Security Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate limiting (coming soon)
- **Input Validation**: Request payload validation

## 📝 API Documentation

The API is fully documented using Swagger/OpenAPI 3.0:

- **Swagger UI**: http://localhost:3000/documentation
- **OpenAPI JSON**: http://localhost:3000/documentation/json
- **OpenAPI YAML**: http://localhost:3000/documentation/yaml

### Example API Response
```json
{
  "success": true,
  "data": {
    "id": "clj7x8y9z000001mh7v2b3c4d",
    "name": "My Awesome Prompt",
    "content": "You are a helpful AI assistant...",
    "description": "A general-purpose assistant prompt",
    "createdAt": "2023-06-15T10:30:00Z",
    "updatedAt": "2023-06-15T10:30:00Z"
  },
  "meta": {
    "timestamp": "2023-06-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

## 🧪 Testing

### Test Structure
```
src/
├── __tests__/
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── helpers/        # Test utilities
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- user.test.ts
```

### Example Test
```typescript
describe('User API', () => {
  it('should create a new user', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: {
        email: 'test@example.com',
        name: 'Test User'
      }
    })
    
    expect(response.statusCode).toBe(201)
    expect(response.json().data.email).toBe('test@example.com')
  })
})
```

## 🚀 Deployment

### Environment Setup
1. **Production Environment Variables**
2. **Database Migration**: `npm run db:deploy`
3. **Build Application**: `npm run build`
4. **Start Server**: `npm start`

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### Deployment Platforms
- **Heroku**: Easy deployment with Git integration
- **Railway**: Modern deployment platform
- **AWS**: EC2, ECS, or Lambda deployment
- **Digital Ocean**: App Platform or Droplets
- **Google Cloud**: Cloud Run or Compute Engine

## 🔧 Configuration

### Environment Variables
```typescript
// src/config/index.ts
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE_TIME || '7d'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  }
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check PostgreSQL connection
   npx prisma db pull
   
   # Reset database (development only)
   npx prisma migrate reset
   ```

2. **Prisma Client Issues**
   ```bash
   # Regenerate Prisma client
   npx prisma generate
   ```

3. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :3000
   
   # Kill process
   kill -9 <PID>
   ```

4. **TypeScript Compilation Errors**
   ```bash
   # Clean build
   rm -rf dist/
   npm run build
   ```

## 🤝 Contributing

### Development Workflow
1. Create a feature branch
2. Write tests for new functionality
3. Implement the feature
4. Run tests and linting
5. Submit a pull request

### Code Standards
- Use TypeScript for all new code
- Follow Fastify plugin patterns
- Write comprehensive tests
- Document all public APIs
- Use Prettier for code formatting

## 📚 Additional Resources

- [Fastify Documentation](https://www.fastify.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [JWT.io](https://jwt.io/) - JWT debugger and information

---

[← Back to Main Documentation](../README.md) | [Frontend Documentation →](../pd-client/README.md) 