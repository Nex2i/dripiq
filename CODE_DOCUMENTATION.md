# 📚 DripIQ Codebase Documentation

## 🚀 Project Overview

**DripIQ** is an AI-powered Salesforce re-engagement platform that transforms closed-lost leads into high-converting opportunities using intelligent drip campaigns and multi-channel engagement.

### 🎯 Core Purpose
- **Automated Follow-up**: Convert closed-lost leads through intelligent automation
- **AI-Powered Research**: Deep prospect research and personalized messaging
- **Multi-Channel Engagement**: Email, SMS, voice, and video outreach
- **Analytics Dashboard**: Performance tracking and ROI insights

### 👥 Target Users
- Account Executives (AEs) – Recover deals without manual follow-up
- Sales Managers/Directors – Improve pipeline health and forecasting
- Revenue Operations Teams – Gain automation and ROI visibility
- Salesforce Administrators – Easy plug-and-play integration

---

## 🏗️ Architecture Overview

### Tech Stack Summary

**Frontend (Client)**
- React 19.0.0 with TypeScript
- Vite 6.1.0 (Build tool)
- TailwindCSS 4.0.6 (Styling)
- TanStack Router (Type-safe routing)
- TanStack Query (Data fetching)
- TanStack Form (Form management)
- TanStack Table (Data tables)
- TanStack Store (State management)
- Supabase (Authentication)
- Zod (Schema validation)

**Backend (Server)**
- Node.js with Fastify framework
- TypeScript for type safety
- Drizzle ORM with PostgreSQL
- Supabase integration for auth
- JWT authentication
- Swagger/OpenAPI documentation
- Pino logger for structured logging

**Database & Infrastructure**
- PostgreSQL (Primary database)
- Supabase (Auth provider)
- Drizzle ORM (Type-safe database access)
- Multi-tenant architecture

---

## 📁 Detailed Directory Structure

```
dripiq/
├── client/                          # React frontend application
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── AuthDebugMenu.tsx    # Development auth state debugging
│   │   │   ├── AuthGuard.tsx        # Route protection component
│   │   │   ├── ContactSalesModal.tsx # Sales inquiry modal
│   │   │   ├── Header.tsx           # Main navigation header
│   │   │   ├── Logo.tsx             # Reusable logo component
│   │   │   └── demo.FormComponents.tsx # Demo form components
│   │   ├── contexts/                # React contexts
│   │   │   └── AuthContext.tsx      # Authentication state management
│   │   ├── data/                    # Static data and mock data
│   │   │   └── demo-table-data.ts   # Sample data for demos
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── demo.form-context.ts # Form context hook
│   │   │   └── demo.form.ts         # Form utilities
│   │   ├── integrations/            # Third-party integrations
│   │   │   └── tanstack-query/      # TanStack Query setup
│   │   │       ├── layout.tsx       # Query devtools layout
│   │   │       └── root-provider.tsx # Query client provider
│   │   ├── lib/                     # Utility libraries
│   │   │   ├── demo-store.ts        # TanStack Store setup
│   │   │   └── supabaseClient.ts    # Supabase client config
│   │   ├── pages/                   # Page components
│   │   │   ├── auth/                # Authentication pages
│   │   │   │   ├── Login.tsx        # User login page
│   │   │   │   └── Register.tsx     # User registration page
│   │   │   ├── demo/                # Demo/showcase pages
│   │   │   │   ├── demo.form.address.tsx # Advanced form demo
│   │   │   │   ├── demo.form.simple.tsx  # Basic form demo
│   │   │   │   ├── demo.store.tsx        # State management demo
│   │   │   │   ├── demo.table.tsx        # Data table demo
│   │   │   │   └── demo.tanstack-query.tsx # Data fetching demo
│   │   │   ├── Dashboard.tsx        # Main dashboard
│   │   │   └── LandingPage.tsx      # Marketing homepage
│   │   ├── routes/                  # Route definitions
│   │   │   └── index.tsx            # Route configuration
│   │   ├── services/                # API services
│   │   │   └── auth.service.ts      # Authentication API calls
│   │   ├── main.tsx                 # Application entry point
│   │   ├── router.tsx               # Router configuration
│   │   └── styles.css               # Global styles and Tailwind
│   ├── public/                      # Static assets
│   │   ├── favicon.svg              # App favicon
│   │   ├── logo192.png              # PWA icons
│   │   ├── logo512.png
│   │   ├── manifest.json            # PWA manifest
│   │   └── robots.txt               # SEO robots file
│   ├── eslint.config.js             # ESLint configuration
│   ├── package.json                 # Dependencies and scripts
│   ├── prettier.config.js           # Code formatting config
│   ├── tsconfig.json                # TypeScript configuration
│   └── vite.config.ts               # Vite build configuration
├── server/                          # Fastify backend application
│   ├── src/
│   │   ├── config/                  # Configuration files
│   │   │   └── index.ts             # Environment variables
│   │   ├── constants/               # Application constants
│   │   │   ├── error-codes.ts       # Error code definitions
│   │   │   └── index.ts             # Constant exports
│   │   ├── db/                      # Database layer
│   │   │   ├── migrations/          # Drizzle migrations
│   │   │   │   ├── 0000_init.sql    # Initial schema
│   │   │   │   └── meta/            # Migration metadata
│   │   │   ├── index.ts             # Database exports
│   │   │   ├── schema.ts            # Database schema definitions
│   │   │   └── seed.ts              # Database seeding
│   │   ├── exceptions/              # Custom exception classes
│   │   │   └── error.ts             # Error class definitions
│   │   ├── extensions/              # Framework extensions
│   │   │   ├── index.ts             # Extension exports
│   │   │   └── string.extensions.ts # String utility methods
│   │   ├── libs/                    # Utility libraries
│   │   │   ├── bcrypt.ts            # Password hashing
│   │   │   ├── drizzleClient.ts     # Database client
│   │   │   ├── logger.ts            # Pino logger setup
│   │   │   └── supabaseClient.ts    # Supabase server client
│   │   ├── modules/                 # Business logic services
│   │   │   ├── tenant.service.ts    # Tenant/organization service
│   │   │   └── user.service.ts      # User management service
│   │   ├── plugins/                 # Fastify plugins
│   │   │   ├── authentication.plugin.ts # JWT auth middleware
│   │   │   └── swagger.plugin.ts    # API documentation
│   │   ├── routes/                  # API route handlers
│   │   │   ├── authentication.routes.ts # Auth endpoints
│   │   │   └── ping.routes.ts       # Health check
│   │   ├── types/                   # TypeScript definitions
│   │   │   ├── fastify.d.ts         # Fastify type extensions
│   │   │   ├── index.d.ts           # Global type exports
│   │   │   └── LessonPlan.ts        # Business entity types
│   │   ├── utils/                   # Utility functions
│   │   │   ├── bankLogos/           # Banking logo utilities
│   │   │   ├── bankNameLogoMapper.ts # Logo mapping service
│   │   │   ├── globalErrorHandler.ts # Error handling
│   │   │   ├── Guid.ts              # GUID generation
│   │   │   ├── HttpMethods.ts       # HTTP method constants
│   │   │   ├── isStringFalsey.ts    # String validation
│   │   │   ├── network.ts           # Network utilities
│   │   │   ├── schemaErrorFormatter.ts # Validation formatting
│   │   │   ├── stringToBool.ts      # Type conversion
│   │   │   ├── userAgent.ts         # User agent parsing
│   │   │   └── validateEnv.ts       # Environment validation
│   │   ├── app.ts                   # Fastify app configuration
│   │   └── index.ts                 # Application entry point
│   ├── drizzle.config.ts            # Drizzle ORM configuration
│   ├── nodemon.json                 # Development server config
│   ├── package.json                 # Dependencies and scripts
│   └── tsconfig.json                # TypeScript configuration
├── AUTH_SETUP.md                    # Authentication setup guide
├── README.md                        # Main project documentation
└── DRIZZLE_MIGRATION.md             # Database migration guide
```

---

## 🖥️ Frontend (Client) Deep Dive

### Entry Point & Configuration

#### `src/main.tsx` (30 lines)
```typescript
const rootElement = document.getElementById('app')
const root = ReactDOM.createRoot(rootElement)
root.render(
  <StrictMode>
    <TanStackQueryProvider.Provider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TanStackQueryProvider.Provider>
  </StrictMode>,
)
```
**Purpose**: Application bootstrap with provider hierarchy
- TanStack Query for server state management
- AuthProvider for authentication context
- Router for navigation management

#### `src/router.tsx` (162 lines)
**Route Structure**:
```typescript
rootRoute/
├── / (LandingPage - public)
├── /auth/* (public only, redirects if authenticated)
│   ├── /auth/login
│   └── /auth/register
└── protected/* (requires authentication)
    ├── /dashboard
    └── /demo/*
        ├── /demo/form/simple
        ├── /demo/form/address
        ├── /demo/store
        ├── /demo/table
        └── /demo/tanstack-query
```

**Key Features**:
- Type-safe routing with TanStack Router
- Route-based code splitting
- Authentication guards (AuthGuard, PublicOnlyGuard)
- Development tools integration

### Authentication System

#### `src/contexts/AuthContext.tsx` (154 lines)
```typescript
interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}
```

**Implementation Details**:
- Supabase auth state listening
- Automatic user data fetching from backend
- Session persistence across page reloads
- Error handling for auth failures

#### `src/services/auth.service.ts`
**Service Methods**:
- `login()`: Authenticate with Supabase
- `register()`: Complete registration flow
- `getCurrentUser()`: Fetch user data from backend
- `onAuthStateChange()`: Subscribe to auth events

### Core Components

#### `src/components/AuthGuard.tsx` (53 lines)
```typescript
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  
  if (loading) return <LoadingSpinner />
  if (!user) {
    navigate({ to: '/auth/login' })
    return null
  }
  return <>{children}</>
}
```

#### `src/components/Header.tsx` (235 lines)
**Features**:
- Responsive navigation menu
- User profile dropdown
- Authentication status display
- Logo and branding integration

#### `src/pages/Dashboard.tsx` (148 lines)
**Dashboard Sections**:
- Welcome message with user name
- Statistics cards (campaigns, leads, revenue, response rate)
- Quick action buttons with navigation
- Recent activity timeline

### Demo System

The application includes comprehensive demos showcasing TanStack ecosystem:

#### Form Demos
- **Simple Form** (`demo.form.simple.tsx`): Basic form with validation
- **Address Form** (`demo.form.address.tsx`): Complex multi-field form

#### Data Management Demos
- **Table Demo** (`demo.table.tsx`): Advanced data table with sorting/filtering
- **Store Demo** (`demo.store.tsx`): Client-side state management
- **Query Demo** (`demo.tanstack-query.tsx`): Server state management

### Build & Development

#### `vite.config.ts` (16 lines)
```typescript
export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') }
  }
})
```

**Vite Configuration**:
- React plugin for JSX transformation
- TailwindCSS integration
- Path aliasing for clean imports
- Hot Module Replacement (HMR)

---

## ⚙️ Backend (Server) Deep Dive

### Application Architecture

#### `src/index.ts` (26 lines)
```typescript
(async () => {
  try {
    const app = await App()
    app.listen({ port: Number(PORT), host: '0.0.0.0' }, () => {
      const networkAddress = getNetworkAddress()
      logger.info(
        `Server running on port ${PORT} 
        \nLocal: https://localhost:${PORT} 
        \nNetwork: https://${networkAddress}:${PORT}`
      )
    })
  } catch (error) {
    logger.error('Error running server:', error)
  }
})()
```

#### `src/app.ts` (60 lines)
**Fastify Configuration**:
```typescript
const app = Fastify({
  schemaErrorFormatter,
  ajv: {
    customOptions: { coerceTypes: false, allErrors: true },
    plugins: [],
  },
  logger: true,
  trustProxy: true,
}).withTypeProvider<TypeBoxTypeProvider>()
```

**Plugin Registration Order**:
1. Environment validation (`fastifyEnv`)
2. CORS configuration (`fastifyCors`)
3. Security headers (`fastifyHelmet`)
4. Custom plugins (auth, swagger)
5. Route auto-loading

### Database Layer

#### `src/db/schema.ts` (81 lines)
**Multi-tenant Schema Design**:

```typescript
// Users table - Links Supabase auth to app data
export const users = appSchema.table('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  supabaseId: text('supabase_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Tenants table - Organizations/companies
export const tenants = appSchema.table('tenants', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Many-to-many relationship with permissions
export const userTenants = appSchema.table('user_tenants', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  isSuperUser: boolean('is_super_user').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

**Relationships**:
- Users can belong to multiple tenants
- Tenants can have multiple users
- Super user permissions per tenant
- Cascade deletes for data integrity

#### `drizzle.config.ts` (33 lines)
```typescript
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl: process.env.DB_DISABLE_SSL !== 'true',
  },
  schemaFilter: [process.env.DB_SCHEMA!],
  verbose: true,
  strict: true,
})
```

### Business Logic Services

#### `src/modules/user.service.ts` (96 lines)
```typescript
export class UserService {
  static async createUser(userData: CreateUserData): Promise<User> {
    // Handle unique constraint violations gracefully
    try {
      const [user] = await db.insert(users).values(newUser).returning()
      return user!
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return await this.getUserBySupabaseId(userData.supabaseId)
      }
      throw error
    }
  }
  
  static async getUserBySupabaseId(supabaseId: string): Promise<User | null>
  static async getUserByEmail(email: string): Promise<User | null>
  static async updateUser(supabaseId: string, updateData: Partial<CreateUserData>): Promise<User>
  static async deleteUser(supabaseId: string): Promise<User>
}
```

#### `src/modules/tenant.service.ts` (165 lines)
**Tenant Management**:
- Tenant CRUD operations
- User-tenant relationship management
- Super user permission handling
- Multi-tenant data isolation

### API Routes

#### `src/routes/authentication.routes.ts` (379 lines)

**POST /api/auth/register**
```typescript
// Complete registration flow
{
  email: string,
  password: string, 
  name: string,
  tenantName: string
}
```

**Registration Process**:
1. Create user in Supabase
2. Create tenant in database
3. Create user profile in database  
4. Link user to tenant as super user
5. Auto-sign in user
6. Return session + user data

**GET /api/auth/me** (Protected)
```typescript
// Headers: Authorization: Bearer <jwt-token>
// Returns: User data with tenant relationships
{
  user: {
    id: string,
    email: string,
    name: string,
    tenants: [
      { id: string, name: string, isSuperUser: boolean }
    ]
  }
}
```

### Security & Middleware

#### `src/plugins/authentication.plugin.ts`
**JWT Middleware**:
- Supabase token validation
- User attachment to request object
- Route protection for sensitive endpoints

#### `src/utils/globalErrorHandler.ts`
**Centralized Error Handling**:
- HTTP status code mapping
- User-friendly error messages
- Logging for debugging
- Validation error formatting

### Configuration & Environment

#### `src/config/index.ts` (27 lines)
```typescript
export const {
  PORT, DATABASE_URL, NODE_ENV,
  SUPABASE_URL, SUPABASE_ANON_KEY,
  STRIPE_API_KEY, PLAID_CLIENT_ID
} = process.env

export const IS_PRODUCTION = NODE_ENV === 'production'
export const IS_DEVELOPMENT = NODE_ENV === 'development'
export const DATABASE_SCHEMA = DB_SCHEMA || 'dripiq_app'
```

---

## 🔐 Authentication Flow Deep Dive

### Registration Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant S as Supabase
    participant D as Database
    
    F->>B: POST /auth/register {email, password, name, tenantName}
    B->>S: signUp(email, password)
    S-->>B: {user: {id, email}}
    B->>D: CREATE tenant (tenantName)
    B->>D: CREATE user (supabaseId, email, name)
    B->>D: CREATE user_tenant (userId, tenantId, isSuperUser: true)
    B->>S: signInWithPassword(email, password)
    S-->>B: {session: {access_token, ...}}
    B-->>F: {user, tenant, session}
```

### Login Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant S as Supabase
    participant B as Backend
    participant D as Database
    
    F->>S: signInWithPassword(email, password)
    S-->>F: {session: {access_token, ...}}
    F->>B: GET /auth/me (Bearer token)
    B->>S: Validate JWT token
    S-->>B: {user: {id, ...}}
    B->>D: SELECT user + tenants WHERE supabaseId = user.id
    D-->>B: {user, tenants}
    B-->>F: {user: {id, email, name, tenants}}
```

### Session Management

- **Frontend**: AuthContext manages auth state with React hooks
- **Backend**: JWT middleware validates tokens on protected routes
- **Persistence**: Supabase handles token refresh automatically
- **Logout**: Clears both Supabase session and application state

---

## 📊 Database Schema Documentation

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    users    │       │  user_tenants   │       │   tenants   │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │────┐  │ id (PK)         │  ┌────│ id (PK)     │
│ supabaseId  │    └──│ userId (FK)     │  │    │ name        │
│ email       │       │ tenantId (FK)   │──┘    │ createdAt   │
│ name        │       │ isSuperUser     │       │ updatedAt   │
│ avatar      │       │ createdAt       │       └─────────────┘
│ createdAt   │       │ updatedAt       │
│ updatedAt   │       └─────────────────┘
└─────────────┘
```

### Data Types & Constraints

**Primary Keys**: All tables use CUID2 for distributed-friendly IDs
**Foreign Keys**: Cascade deletes maintain referential integrity
**Timestamps**: Automatic `createdAt` and `updatedAt` tracking
**Unique Constraints**: 
- `users.supabaseId` (links to Supabase auth)
- `users.email` (unique across system)
- `user_tenants(userId, tenantId)` (prevents duplicate relationships)

### Migration Strategy

```bash
# Generate new migration
npm run db:migrate:new "add_campaigns_table"

# Apply migrations
npm run db:migrate

# Rollback (manual)
# Edit migration file and re-run migrate
```

---

## 🌐 API Reference

### Base Configuration

- **Base URL**: `http://localhost:3001/api`
- **Content-Type**: `application/json`
- **Authentication**: `Bearer <jwt-token>`
- **Documentation**: `http://localhost:3001/docs`

### Authentication Endpoints

#### POST /auth/register
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "tenantName": "Acme Corporation"
}
```

**Success Response** (201 Created):
```json
{
  "message": "Registration successful",
  "user": {
    "id": "user_clx1234567890",
    "email": "user@example.com", 
    "name": "John Doe"
  },
  "tenant": {
    "id": "tenant_clx1234567890",
    "name": "Acme Corporation"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "expires_at": 1640995200,
    "refresh_token": "refresh_token_here",
    "user": { /* Supabase user object */ }
  }
}
```

#### GET /auth/me (Protected)
**Headers**: `Authorization: Bearer <token>`

**Success Response** (200 OK):
```json
{
  "user": {
    "id": "user_clx1234567890",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "tenants": [
      {
        "id": "tenant_clx1234567890",
        "name": "Acme Corporation",
        "isSuperUser": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### GET /ping (Health Check)
**Success Response** (200 OK):
```json
{
  "message": "pong", 
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123456,
  "version": "1.0.0"
}
```

### Error Responses

#### Validation Errors (400 Bad Request)
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body must have required property 'email'",
  "validation": [
    {
      "instancePath": "",
      "schemaPath": "#/required",
      "keyword": "required",
      "params": { "missingProperty": "email" }
    }
  ]
}
```

#### Authentication Errors (401 Unauthorized)
```json
{
  "statusCode": 401,
  "error": "Unauthorized", 
  "message": "Invalid or expired token"
}
```

#### Server Errors (500 Internal Server Error)
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## 🚀 Development & Deployment

### Local Development Setup

#### Prerequisites
- Node.js 18+ with npm
- PostgreSQL 13+
- Supabase account
- Git

#### Environment Variables

**Client (.env)**:
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Server (.env)**:
```env
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dripiq
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=dripiq
DB_SCHEMA=dripiq_app
DB_DISABLE_SSL=true

# Supabase Configuration  
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server Configuration
PORT=3001
NODE_ENV=development
CREDENTIALS=true
FRONTEND_ORIGIN=http://localhost:3000

# Optional Third-party APIs
STRIPE_API_KEY=sk_test_...
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
API_URL=http://localhost:3001
```

#### Installation Steps

```bash
# 1. Clone and setup
git clone https://github.com/your-org/dripiq.git
cd dripiq

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Setup environment files
cd ../server && cp .env.example .env
cd ../client && cp .env.example .env
# Edit .env files with your configuration

# 4. Initialize database
cd ../server
npm run db:generate  # Generate Drizzle client
npm run db:migrate   # Run migrations
npm run db:seed      # Seed sample data

# 5. Start development servers
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend  
cd client && npm run dev
```

#### Development URLs
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs
- **Database Studio**: `npm run db:studio`

### Build Process

#### Frontend Build
```bash
cd client
npm run build  # Vite production build + TypeScript compilation
```
**Output**: `client/dist/` (static files ready for hosting)

#### Backend Build
```bash
cd server  
npm run build  # TypeScript compilation + path alias resolution
```
**Output**: `server/dist/` (Node.js ready files)

### Production Deployment

#### Environment Configuration
```env
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:pass@prod-host:5432/dripiq
SUPABASE_URL=https://prod-project.supabase.co
CORS_ORIGIN=https://yourdomain.com
JWT_SECRET=super-secure-production-secret
```

#### Hosting Recommendations

**Frontend Options**:
- **Netlify**: `netlify.toml` configuration included
- **Vercel**: Automatic deployment from Git
- **AWS S3 + CloudFront**: Custom CDN setup

**Backend Options**:
- **Railway**: Simple PostgreSQL + Node.js deployment  
- **Heroku**: Traditional PaaS hosting
- **DigitalOcean App Platform**: Managed containers
- **AWS ECS/Fargate**: Scalable container hosting

**Database Options**:
- **Supabase**: Managed PostgreSQL with built-in auth
- **AWS RDS**: Production PostgreSQL with backups
- **DigitalOcean Managed Databases**: Cost-effective option

---

## 🧪 Testing Strategy

### Frontend Testing

#### Test Configuration
```json
// vitest.config.js
{
  "testEnvironment": "jsdom",
  "setupFiles": ["./src/test/setup.ts"],
  "globals": true
}
```

#### Testing Patterns
```typescript
// Component testing example
import { render, screen } from '@testing-library/react'
import { AuthGuard } from '../components/AuthGuard'

test('redirects to login when user not authenticated', () => {
  render(<AuthGuard><div>Protected content</div></AuthGuard>)
  expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
})
```

### Backend Testing

#### Test Structure
```bash
server/src/__tests__/
├── integration/          # API endpoint tests
│   ├── auth.test.ts     # Authentication flows
│   └── users.test.ts    # User management
├── unit/                # Service layer tests  
│   ├── user.service.test.ts
│   └── tenant.service.test.ts
└── utils/               # Test utilities
    └── testDb.ts        # Test database setup
```

#### API Testing Example
```typescript
describe('POST /auth/register', () => {
  test('creates user and tenant successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        tenantName: 'Test Corp'
      }
    })
    
    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      message: 'Registration successful',
      user: { email: 'test@example.com' }
    })
  })
})
```

---

## 🎯 Performance & Optimization

### Frontend Optimizations

#### Code Splitting
```typescript
// Route-based code splitting with TanStack Router
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Login = lazy(() => import('./pages/auth/Login'))
```

#### Bundle Analysis
```bash
cd client
npm run build
npx vite-bundle-analyzer dist
```

### Backend Optimizations

#### Database Query Optimization
```typescript
// Efficient user + tenant loading
const userWithTenants = await db
  .select()
  .from(users)
  .leftJoin(userTenants, eq(users.id, userTenants.userId))
  .leftJoin(tenants, eq(userTenants.tenantId, tenants.id))
  .where(eq(users.supabaseId, supabaseId))
```

#### Response Caching
```typescript
// Fastify caching plugin
await app.register(require('@fastify/caching'), {
  privacy: 'private',
  expiresIn: 300 // 5 minutes
})
```

### Monitoring & Logging

#### Structured Logging
```typescript
// Pino logger with structured data
logger.info({
  userId: user.id,
  action: 'user_login',
  timestamp: new Date().toISOString()
}, 'User logged in successfully')
```

---

## 🔮 Future Enhancements

### Planned Features

#### AI Integration
- **OpenAI/Claude** for personalized message generation
- **Lead research** automation using web scraping
- **Campaign optimization** through ML algorithms

#### Salesforce Integration  
- **OAuth 2.0** authentication flow
- **Real-time sync** of closed-lost opportunities
- **Custom field mapping** for lead enrichment
- **Webhook handling** for instant updates

#### Multi-Channel Outreach
- **Email campaigns** (SendGrid/Mailgun integration)
- **SMS messaging** (Twilio integration)  
- **Voice calls** and voicemail drops
- **Video messages** with AI-generated scripts
- **LinkedIn automation** for social selling

#### Advanced Analytics
- **Campaign performance** dashboards
- **Revenue attribution** tracking
- **A/B testing** for message optimization
- **Predictive analytics** for lead scoring
- **ROI calculations** and reporting

### Technical Roadmap

#### Scalability Improvements
- **Microservices** architecture for modular scaling
- **Event-driven** communication with message queues
- **Horizontal scaling** with load balancers
- **Database sharding** for multi-tenant isolation
- **CDN integration** for global performance

#### Security Enhancements
- **Rate limiting** for API protection
- **Input sanitization** and XSS prevention
- **SQL injection** prevention (already implemented)
- **Audit logging** for compliance
- **GDPR compliance** tools

#### Developer Experience
- **GraphQL API** option alongside REST
- **Real-time subscriptions** via WebSockets
- **SDK development** for third-party integrations
- **Comprehensive testing** suite expansion
- **CI/CD pipeline** automation

---

## 📞 Support & Contributing

### Code Quality Standards

#### TypeScript Best Practices
- **Strict mode** enabled across all files
- **Interface definitions** for all API contracts
- **Type guards** for runtime validation
- **Generic types** for reusable components

#### Error Handling Patterns
```typescript
// Service layer error handling
try {
  const user = await UserService.createUser(userData)
  return { success: true, user }
} catch (error) {
  logger.error('User creation failed', { error, userData })
  throw new CustomError('Failed to create user', 500)
}
```

### Git Workflow

#### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/***: Individual feature development
- **hotfix/***: Critical production fixes

#### Commit Conventions
```bash
# Semantic commit messages
feat: add user registration endpoint
fix: resolve authentication token validation
docs: update API documentation
test: add user service unit tests
refactor: improve error handling structure
```

### Documentation Updates

This documentation should be updated when:
- New features are added to the application
- API endpoints are modified or added
- Database schema changes occur
- Environment variables are added/changed
- Third-party integrations are implemented

---

For technical questions or clarifications, please review the inline code comments or contact the development team. 