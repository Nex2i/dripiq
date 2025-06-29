# Authentication Setup Guide

This guide explains how to set up the complete authentication system that connects the frontend with Supabase and your backend API.

## Overview

The authentication system includes:
- **Frontend**: React app with Supabase authentication
- **Backend**: FastifyJS API with user management and tenant support
- **Database**: PostgreSQL with Supabase for authentication
- **Protected Routes**: All non-auth routes require authentication
- **Centralized Routing**: Single router configuration with auth guards

## Setup Instructions

### 1. Environment Configuration

#### Client Environment Variables
Create a `.env.local` file in the `client/` directory:

```bash
# API Configuration
VITE_API_URL=http://localhost:8080

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Server Environment Variables
Ensure your `server/.env` file includes:

```bash
# Database
DATABASE_URL=your_postgresql_connection_string

# Supabase Configuration  
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note down your project URL and anon key

2. **Database Setup**
   - The backend includes migration scripts for users and tenants
   - Run `npm run db:migrate` in the server directory

3. **Authentication Configuration**
   - In Supabase dashboard, go to Authentication > Settings
   - Configure your site URL (http://localhost:3000 for development)
   - Enable email authentication

### 3. Backend Setup

The backend already includes:
- User management endpoints (`/auth/register`, `/auth/me`, `/auth/logout`)
- Supabase JWT token validation
- Tenant management
- Authentication middleware

Key endpoints:
- `POST /auth/register` - Complete registration flow
- `GET /auth/me` - Get current user data
- `DELETE /auth/logout` - Sign out user

### 4. Frontend Architecture

#### Authentication Service (`src/services/auth.service.ts`)
Handles all authentication operations:
- Login/logout with Supabase
- Backend API communication
- JWT token management
- Session management

#### Auth Context (`src/contexts/AuthContext.tsx`)
Provides authentication state throughout the app:
- Current user data
- Loading states
- Auth functions (login, register, logout)

#### Auth Guards (`src/components/AuthGuard.tsx`)
- `AuthGuard` - Protects routes, redirects to login if not authenticated
- `PublicOnlyGuard` - For auth pages, redirects to home if already logged in

#### Centralized Routing (`src/router.tsx`)
- All routes defined in one place
- Auth guards applied automatically
- Routes prefixed with `/auth` are public
- All other routes require authentication

## Usage

### Starting the Development Environment

1. **Start the Backend**
   ```bash
   cd server
   npm run dev
   ```

2. **Start the Frontend**
   ```bash
   cd client
   npm run dev
   ```

### Authentication Flow

1. **Registration**
   - User visits `/auth/register`
   - Form submits to backend `/auth/register` endpoint
   - Backend creates user in Supabase and database
   - User is automatically signed in
   - Redirected to home page

2. **Login**
   - User visits `/auth/login`
   - Credentials sent to Supabase
   - JWT token stored in session
   - Backend validates token and returns user data
   - Redirected to home page

3. **Protected Routes**
   - All non-auth routes check authentication
   - Unauthenticated users redirected to login
   - User data fetched from backend on each route

4. **Logout**
   - Backend logout endpoint called
   - Supabase session cleared
   - User redirected to login

### Adding New Protected Routes

1. Create your route component
2. Add route to `src/router.tsx`
3. The `wrapWithAuthGuard` function automatically protects it

Example:
```typescript
// Add to router.tsx
const myNewRoute = wrapWithAuthGuard(MyNewRouteCreator)

// Add to routeTree
const routeTree = rootRoute.addChildren([
  // ... existing routes
  myNewRoute,
])
```

### Adding New Public Routes

For routes that should be accessible without authentication:

```typescript
const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/public-page',
  component: PublicPageComponent,
})
```

## API Integration

The auth service automatically handles API authentication:

```typescript
import { authService } from '../services/auth.service'

// Get auth headers for API requests
const headers = await authService.getAuthHeaders()

fetch('/api/some-endpoint', {
  headers: {
    'Content-Type': 'application/json',
    ...headers, // Includes Bearer token if authenticated
  },
})
```

## Troubleshooting

### Common Issues

1. **"User not found in database"**
   - Registration might have failed partway
   - Check backend logs
   - Ensure database migrations ran

2. **Token validation errors**
   - Check Supabase configuration
   - Verify JWT token in browser dev tools
   - Ensure backend can reach Supabase

3. **Routing issues**
   - Clear browser cache/localStorage
   - Check TypeScript errors in router configuration

### Development Tips

1. **Check Authentication State**
   - Use browser dev tools to inspect localStorage
   - Check network tab for auth requests
   - Use the auth context in components to debug

2. **Backend Debugging**
   - Check server logs for authentication errors
   - Test endpoints with tools like Postman
   - Verify database connections

3. **Frontend Debugging**
   - Use React Developer Tools
   - Check auth context state
   - Monitor network requests to backend

## Security Considerations

1. **JWT Tokens**
   - Tokens are stored in Supabase session (httpOnly cookies recommended for production)
   - Tokens automatically refresh via Supabase

2. **Backend Validation**
   - All protected endpoints validate JWT tokens
   - User data fetched from database, not just token claims

3. **CORS Configuration**
   - Ensure backend CORS allows your frontend domain
   - Configure Supabase site URLs correctly

## Production Deployment

1. **Environment Variables**
   - Set production Supabase URLs
   - Use production database
   - Configure proper CORS origins

2. **Security**
   - Use HTTPS for all communication
   - Configure Supabase RLS policies
   - Implement proper error handling

3. **Performance**
   - Consider token refresh strategies
   - Implement proper loading states
   - Cache user data appropriately

## File Structure

```
client/src/
├── services/
│   └── auth.service.ts          # Auth API communication
├── contexts/
│   └── AuthContext.tsx          # Auth state management
├── components/
│   └── AuthGuard.tsx           # Route protection
├── pages/
│   └── auth/
│       ├── Login.tsx           # Login page
│       └── Register.tsx        # Registration page
├── router.tsx                  # Centralized routing
└── main.tsx                    # App entry with providers

server/src/
├── routes/
│   └── authentication.routes.ts # Auth API endpoints
├── plugins/
│   └── authentication.plugin.ts # JWT validation
└── modules/
    ├── user.service.ts         # User management
    └── tenant.service.ts       # Tenant management
```

This authentication system provides a robust foundation for a multi-tenant application with secure user management and proper session handling. 