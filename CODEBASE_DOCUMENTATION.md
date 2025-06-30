# 📚 DripIQ Codebase Documentation

## 🚀 Project Overview

**DripIQ** is an AI-powered Salesforce re-engagement platform that transforms closed-lost leads into high-converting opportunities using intelligent drip campaigns and multi-channel engagement.

### 🎯 Core Purpose
- **Automated Follow-up**: Convert closed-lost leads through intelligent automation
- **AI-Powered Research**: Deep prospect research and personalized messaging
- **Multi-Channel Engagement**: Email, SMS, voice, and video outreach
- **Analytics Dashboard**: Performance tracking and ROI insights

### 👥 Target Users
- Account Executives (AEs)
- Sales Managers/Directors
- Revenue Operations Teams
- Salesforce Administrators

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

**Backend (Server)**
- Node.js with Fastify framework
- TypeScript for type safety
- Drizzle ORM with PostgreSQL
- Supabase integration for auth
- JWT authentication
- Swagger/OpenAPI documentation

**Database & Infrastructure**
- PostgreSQL (Primary database)
- Supabase (Auth provider)
- Drizzle ORM (Type-safe database access)

---

## 📁 Project Structure

```
dripiq/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts (Auth)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── integrations/   # Third-party integrations
│   │   ├── lib/            # Utility libraries
│   │   ├── pages/          # Page components
│   │   ├── routes/         # Route definitions
│   │   ├── services/       # API services
│   │   └── data/           # Static data and demos
│   ├── public/             # Static assets
│   └── dist/               # Build output
├── server/                 # Fastify backend application
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── db/             # Database schema and migrations
│   │   ├── modules/        # Business logic services
│   │   ├── routes/         # API route handlers
│   │   ├── plugins/        # Fastify plugins
│   │   ├── utils/          # Utility functions
│   │   └── types/          # TypeScript type definitions
│   └── dist/               # Compiled output
└── docs/                   # Documentation
```

---

## 🖥️ Frontend (Client) Documentation

### Core Technologies & Features

#### React 19.0.0 with Modern Patterns
- Latest React features and concurrent rendering
- Strict TypeScript configuration
- Hot Module Replacement (HMR) for development

#### TanStack Ecosystem Integration
- **Router**: File-based routing with type safety
- **Query**: Server state management and caching
- **Form**: Form state and validation
- **Table**: Headless table components
- **Store**: Client-side state management

### Key Components

#### 📂 `src/components/`

**AuthGuard.tsx** (`1.3KB`)
- Route protection component
- Redirects unauthorized users to login
- Supports both protected and public-only routes

**Header.tsx** (`10KB, 235 lines`)
- Main navigation component
- User menu and authentication status
- Responsive design with TailwindCSS

**Logo.tsx** (`2.0KB, 71 lines`)
- Reusable logo component
- SVG-based with consistent branding

**ContactSalesModal.tsx** (`11KB, 317 lines`)
- Modal component for sales inquiries
- Form integration with validation

**AuthDebugMenu.tsx** (`7.1KB, 201 lines`)
- Development tool for auth state debugging
- Shows current user, session, and auth methods

**demo.FormComponents.tsx** (`3.4KB, 128 lines`)
- Reusable form components for demos
- Input fields, buttons, validation displays

#### 📂 `src/contexts/`

**AuthContext.tsx** (`154 lines`)
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
- Centralized authentication state management
- Supabase integration for auth flows
- Automatic session handling and user refresh

#### 📂 `src/pages/`

**LandingPage.tsx**
- Marketing homepage
- Feature showcases and CTAs

**Dashboard.tsx** (`148 lines`)
- Main app interface post-login
- Quick action cards
- Statistics overview
- Recent activity feed
- Navigation to key features

**Auth Pages**
- `auth/Login.tsx`: User login interface
- `auth/Register.tsx`: User registration with tenant creation

**Demo Pages** (`src/pages/demo/`)
- `demo.form.simple.tsx`: Basic form demonstration
- `demo.form.address.tsx`: Advanced address form
- `demo.table.tsx`: Data table with sorting/filtering
- `demo.store.tsx`: State management demonstration
- `demo.tanstack-query.tsx`: Data fetching examples

#### 📂 `src/services/`

**auth.service.ts**
- Authentication API calls
- User session management
- Supabase client integration
- JWT token handling

#### 📂 `src/lib/`

**supabaseClient.ts** (`13 lines`)
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
- Supabase client configuration
- Environment variable validation

**demo-store.ts**
- TanStack Store configuration
- Demo state management

#### Routing Structure (`src/router.tsx`, `162 lines`)

```typescript
// Route hierarchy
rootRoute/
├── / (landing - public)
├── /auth/* (public only)
│   ├── /auth/login
│   └── /auth/register
└── protected/* (requires auth)
    ├── /dashboard
    └── /demo/*
        ├── /demo/form/simple
        ├── /demo/form/address
        ├── /demo/store
        ├── /demo/table
        └── /demo/tanstack-query
```

### Build Configuration

#### Vite Config (`vite.config.ts`)
```typescript
export default defineConfig({
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') }
  }
})
```

#### Package.json Scripts
- `npm run dev`: Development server (port 3000)
- `npm run build`: Production build with TypeScript
- `npm run test`: Vitest test runner
- `npm run lint`: ESLint code checking
- `npm run format`: Prettier code formatting

---

## ⚙️ Backend (Server) Documentation

### Core Architecture

#### Fastify Framework
- High-performance HTTP server
- TypeScript integration with TypeBox
- Plugin-based architecture
- Automatic route registration

#### Database Integration
- Drizzle ORM for type-safe database access
- PostgreSQL with custom schema support
- Migration system with versioning

### Key Files & Modules

#### 📂 `src/app.ts` (`60 lines`)
```typescript
// Fastify app configuration
const app = Fastify({
  schemaErrorFormatter,
  logger: true,
  trustProxy: true,
}).withTypeProvider<TypeBoxTypeProvider>()
```
- Core Fastify setup
- Plugin registration
- CORS and security configuration
- Route auto-loading

#### 📂 `src/index.ts` (`26 lines`)
- Application entry point
- Environment configuration
- Server startup and port binding

#### 📂 `src/config/index.ts` (`27 lines`)
```typescript
export const {
  PORT, DATABASE_URL, NODE_ENV,
  STRIPE_API_KEY, PLAID_CLIENT_ID
} = process.env
```
- Environment variable exports
- Environment detection utilities
- Default configurations

### Database Layer

#### 📂 `src/db/schema.ts` (`81 lines`)

**Core Tables:**
```typescript
// Users table
export const users = appSchema.table('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  supabaseId: text('supabase_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Tenants table (Organizations)
export const tenants = appSchema.table('tenants', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// User-Tenant relationships
export const userTenants = appSchema.table('user_tenants', {
  userId: text('user_id').references(() => users.id),
  tenantId: text('tenant_id').references(() => tenants.id),
  isSuperUser: boolean('is_super_user').default(false),
  // ... timestamps
})
```

**Relations:**
- Users can belong to multiple tenants
- Tenants can have multiple users
- Super user privileges per tenant

#### 📂 `src/db/migrations/`
- Drizzle migration files
- Version controlled schema changes
- Automated deployment pipeline

### Business Logic Modules

#### 📂 `src/modules/user.service.ts` (`96 lines`)

**UserService Class:**
```typescript
export class UserService {
  static async createUser(userData: CreateUserData): Promise<User>
  static async getUserBySupabaseId(supabaseId: string): Promise<User | null>
  static async getUserByEmail(email: string): Promise<User | null>
  static async updateUser(supabaseId: string, updateData: Partial<CreateUserData>): Promise<User>
  static async deleteUser(supabaseId: string): Promise<User>
}
```
- CRUD operations for users
- Supabase ID integration
- Error handling for duplicate users

#### 📂 `src/modules/tenant.service.ts` (`165 lines`)

**TenantService Class:**
- Tenant (organization) management
- User-tenant relationship handling
- Super user permissions

### API Routes

#### 📂 `src/routes/authentication.routes.ts` (`379 lines`)

**Authentication Endpoints:**

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
- Creates user in Supabase
- Creates tenant in database
- Links user to tenant as super user
- Auto sign-in after registration

**POST /api/auth/users**
```typescript
// Create user in database
{
  supabaseId: string,
  email: string,
  name?: string,
  avatar?: string
}
```

**GET /api/auth/me**
- Protected endpoint (requires auth)
- Returns current user data from database
- Includes tenant relationships

#### 📂 `src/routes/ping.routes.ts`
- Health check endpoint
- Server status verification

### Plugins & Middleware

#### 📂 `src/plugins/authentication.plugin.ts`
- JWT authentication middleware
- Supabase token validation
- Request user attachment

#### 📂 `src/plugins/swagger.plugin.ts`
- API documentation generation
- OpenAPI schema integration
- Development documentation UI

### Utilities & Libraries

#### 📂 `src/libs/`

**logger.ts**
- Pino logger configuration
- Structured logging

**supabaseClient.ts**
- Server-side Supabase client
- Admin operations

**drizzleClient.ts**
- Database connection setup
- Connection pooling

#### 📂 `src/utils/`

**globalErrorHandler.ts**
- Centralized error handling
- HTTP status code mapping

**schemaErrorFormatter.ts**
- TypeBox validation error formatting
- User-friendly error messages

**validateEnv.ts**
- Environment variable validation
- Required configuration checking

### Package.json Scripts

```json
{
  "dev": "npm i && npm run db:deploy && npm run nodemon",
  "db:deploy": "npm run db:migrate && npm run db:seed",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx src/db/seed.ts",
  "build": "tsc -p tsconfig.json && tsc-alias -p tsconfig.json",
  "start": "node dist/index.js"
}
```

---

## 🗃️ Database Schema Design

### Schema Overview

The application uses a **multi-tenant architecture** with the following core entities:

#### Core Tables

1. **Users** (`users`)
   - Primary user data from Supabase
   - Links Supabase auth to application data

2. **Tenants** (`tenants`)
   - Organizations/companies
   - Isolation boundary for data

3. **User-Tenant Relationships** (`user_tenants`)
   - Many-to-many relationship
   - Role-based permissions (super user flag)

#### Drizzle Configuration (`drizzle.config.ts`)

```typescript
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { /* PostgreSQL config */ },
  schemaFilter: [schemaName], // Multi-schema support
})
```

### Migration System

- **Auto-generated migrations** via Drizzle Kit
- **Version controlled** schema changes
- **Environment-specific** schema names
- **Rollback capabilities** for safe deployments

---

## 🔐 Authentication System

### Architecture Overview

The authentication system uses a **hybrid approach**:
1. **Supabase** handles auth flows (login, register, sessions)
2. **Application database** stores user profiles and relationships
3. **JWT tokens** for API authentication

### Authentication Flow

#### Registration Process
1. **Frontend** collects user + tenant info
2. **Backend** creates user in Supabase
3. **Backend** creates tenant in database
4. **Backend** creates user profile in database
5. **Backend** links user to tenant as super user
6. **Backend** auto-signs in user
7. **Frontend** receives session + user data

#### Login Process
1. **Frontend** sends credentials to Supabase
2. **Supabase** returns session token
3. **Frontend** calls `/api/auth/me` with token
4. **Backend** validates token and returns user data
5. **Frontend** updates auth context

#### Session Management
- **AuthContext** manages auth state
- **Automatic token refresh** via Supabase
- **Session persistence** across page reloads
- **Auth state change listeners** for real-time updates

### Security Features

- **JWT token validation** on protected routes
- **CORS configuration** for cross-origin requests
- **Helmet security headers**
- **Input validation** with TypeBox schemas
- **SQL injection prevention** via Drizzle ORM

---

## 🌐 API Documentation

### Base Configuration

- **Base URL**: `http://localhost:3001/api`
- **Documentation**: `http://localhost:3001/docs` (Swagger UI)
- **Content-Type**: `application/json`
- **Authentication**: Bearer JWT token

### Endpoint Reference

#### Authentication Endpoints

**POST /auth/register**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "tenantName": "Acme Corp"
}
```
Response: `201 Created`
```json
{
  "message": "Registration successful",
  "user": { "id": "...", "email": "...", "name": "..." },
  "tenant": { "id": "...", "name": "..." },
  "session": { "access_token": "...", "expires_at": 1234567890 }
}
```

**GET /auth/me** (Protected)
Headers: `Authorization: Bearer <token>`
Response: `200 OK`
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "tenants": [
      {
        "id": "tenant_456",
        "name": "Acme Corp",
        "isSuperUser": true
      }
    ]
  }
}
```

#### Health Check

**GET /ping**
Response: `200 OK`
```json
{
  "message": "pong",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345
}
```

### Error Responses

**Standard Error Format:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**Common Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## 🚀 Development Setup

### Prerequisites

- **Node.js** 18+ with npm
- **PostgreSQL** 13+
- **Supabase** account
- **Git** for version control

### Environment Configuration

#### Client (.env)
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Server (.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dripiq
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=dripiq
DB_SCHEMA=dripiq_app

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Server
PORT=3001
NODE_ENV=development
CREDENTIALS=true
FRONTEND_ORIGIN=http://localhost:3000

# Optional APIs
STRIPE_API_KEY=sk_test_...
PLAID_CLIENT_ID=your-plaid-id
```

### Installation & Startup

```bash
# 1. Clone repository
git clone https://github.com/your-org/dripiq.git
cd dripiq

# 2. Install server dependencies
cd server
npm install

# 3. Install client dependencies
cd ../client
npm install

# 4. Setup database
cd ../server
npm run db:generate  # Generate Drizzle schemas
npm run db:migrate   # Run migrations
npm run db:seed      # Seed with sample data

# 5. Start development servers
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

### Development URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs
- **Database Studio**: `npm run db:studio` (Drizzle Studio)

### Development Tools

#### Code Quality
- **ESLint**: Code linting with TypeScript rules
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **TanStack ESLint Config**: Opinionated linting rules

#### Testing
- **Vitest**: Frontend testing framework
- **@testing-library/react**: Component testing
- **Jest**: Backend testing (configured)

#### Database Tools
- **Drizzle Studio**: Visual database browser
- **Drizzle Kit**: Migration management
- **Schema introspection**: TypeScript type generation

---

## 🎨 Styling & UI System

### TailwindCSS Configuration

The project uses **TailwindCSS v4.0** with:
- **Utility-first** CSS approach
- **Responsive design** utilities
- **Custom color palette** for branding
- **Component-based** styling patterns

### Design System

#### Color Palette
- **Primary**: Blue variants for CTAs and links
- **Secondary**: Gray scale for text and backgrounds
- **Success**: Green for positive actions
- **Warning**: Yellow for alerts
- **Error**: Red for errors

#### Typography
- **Font Family**: System font stack
- **Font Sizes**: Responsive scale (text-sm to text-4xl)
- **Font Weights**: 400 (normal) to 700 (bold)

#### Spacing & Layout
- **Container**: Max-width responsive containers
- **Grid System**: CSS Grid and Flexbox utilities
- **Padding/Margin**: Consistent spacing scale

### Component Patterns

#### Cards
```html
<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <!-- Card content -->
</div>
```

#### Buttons
```html
<button class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
  Primary Button
</button>
```

#### Forms
```html
<input class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
```

---

## 📊 Demo Features

The application includes comprehensive demo pages showcasing TanStack ecosystem capabilities:

### Form Demonstrations

#### Simple Form (`demo.form.simple.tsx`)
- Basic form with validation
- TanStack Form integration
- Real-time validation feedback

#### Address Form (`demo.form.address.tsx`)
- Complex multi-field form
- Nested validation schemas
- Address autocomplete simulation

### Data Management

#### Table Demo (`demo.table.tsx`)
- TanStack Table implementation
- Sorting, filtering, pagination
- Mock data with Faker.js

#### Store Demo (`demo.store.tsx`)
- TanStack Store usage
- Client-side state management
- Reactive updates

#### Query Demo (`demo.tanstack-query.tsx`)
- Data fetching patterns
- Cache management
- Loading and error states

---

## 🔧 Configuration Files

### TypeScript Configuration

#### Client (`client/tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

#### Server (`server/tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "outDir": "./dist"
  }
}
```

### Build & Development

#### Package Manager
- **npm** for dependency management
- **package-lock.json** for dependency locking
- **Node.js 18+** compatibility

#### Hot Reload
- **Vite HMR** for frontend
- **Nodemon** for backend
- **TypeScript watch mode**

---

## 🚀 Deployment & Production

### Build Process

#### Frontend Build
```bash
cd client
npm run build  # Vite production build + TypeScript
```
Output: `client/dist/`

#### Backend Build
```bash
cd server
npm run build  # TypeScript compilation + path aliasing
```
Output: `server/dist/`

### Environment Configuration

#### Production Environment Variables
```env
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:pass@prod-host:5432/dripiq
SUPABASE_URL=https://prod-project.supabase.co
JWT_SECRET=production-secret-key
CORS_ORIGIN=https://yourdomain.com
```

### Database Deployment

#### Migration Strategy
```bash
# Production deployment
npm run db:migrate     # Apply pending migrations
npm run db:seed        # Optional: seed production data
```

#### Schema Management
- **Version controlled** migrations
- **Rollback capabilities**
- **Environment isolation**

### Hosting Recommendations

#### Frontend
- **Netlify**: Static site hosting with build automation
- **Vercel**: Optimized for React applications
- **AWS S3 + CloudFront**: Custom CDN setup

#### Backend
- **Railway**: Simple Node.js deployment
- **Heroku**: Traditional PaaS hosting
- **AWS ECS**: Containerized deployment
- **DigitalOcean App Platform**: Managed hosting

#### Database
- **Supabase**: Managed PostgreSQL with auth
- **AWS RDS**: Production PostgreSQL
- **DigitalOcean Managed Databases**

---

## 🧪 Testing Strategy

### Frontend Testing

#### Testing Framework
- **Vitest**: Fast unit testing
- **@testing-library/react**: Component testing
- **jsdom**: DOM environment

#### Test Types
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: (Future) Full user flow testing

### Backend Testing

#### Testing Framework
- **Jest**: Node.js testing framework
- **Supertest**: HTTP assertion testing
- **Test Databases**: Isolated test environments

#### Test Coverage
- **API Endpoints**: Request/response validation
- **Business Logic**: Service layer testing
- **Database Operations**: ORM interaction testing

---

## 🎯 Future Enhancements

### Planned Features

#### AI Integration
- **OpenAI/Claude** for content generation
- **Lead research** automation
- **Personalized messaging** at scale

#### Salesforce Integration
- **OAuth 2.0** authentication
- **Closed-lost opportunity** syncing
- **Custom field mapping**

#### Multi-Channel Outreach
- **Email** campaigns (SendGrid/Mailgun)
- **SMS** messaging (Twilio)
- **Voice** calls and voicemail
- **Video** message generation

#### Advanced Analytics
- **Campaign performance** tracking
- **Revenue recovery** metrics
- **A/B testing** capabilities
- **ROI calculation** and reporting

### Technical Improvements

#### Performance
- **Code splitting** for faster loading
- **Database indexing** optimization
- **CDN integration** for static assets
- **Caching strategies** for API responses

#### Scalability
- **Microservices** architecture
- **Event-driven** communication
- **Queue system** for background jobs
- **Horizontal scaling** for high load

#### Security
- **Rate limiting** for API endpoints
- **Input sanitization** and validation
- **Security headers** and CSP
- **Audit logging** for compliance

---

## 📞 Support & Maintenance

### Code Quality Standards

#### TypeScript Usage
- **Strict mode** enabled
- **Type definitions** for all APIs
- **Interface documentation**
- **Generic type usage**

#### Error Handling
- **Centralized error handling**
- **User-friendly error messages**
- **Logging and monitoring**
- **Graceful degradation**

### Development Guidelines

#### Code Organization
- **Feature-based** directory structure
- **Separation of concerns**
- **Reusable components**
- **Consistent naming conventions**

#### Git Workflow
- **Feature branches** for development
- **Pull request** review process
- **Semantic commit** messages
- **Automated CI/CD** pipelines

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Contributors**: Development Team

For questions or support, please refer to the project README or contact the development team. 