# Tenant Validation Implementation

This document outlines the comprehensive tenant validation system implemented to ensure that all database operations are properly scoped to tenants and users can only access resources they have permission to.

## Overview

The tenant validation system implements multi-tenant security by:

1. **Database Schema Changes**: Added `tenantId` foreign key to resources that need tenant isolation
2. **Automatic Tenant Determination**: Server automatically determines user's tenant context from their associations
3. **Service Layer Validation**: Added tenant access validation to all database operations
4. **Simplified Authentication**: Single authentication layer with automatic tenant resolution

## Database Schema Changes

### Modified Tables

#### `leads` table
- **Added**: `tenantId` column (foreign key to `tenants.id`)
- **Migration**: `0005_clammy_plazm.sql`

```sql
ALTER TABLE leads ADD COLUMN tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE;
```

## Authentication Architecture

### Enhanced Authentication (`authPrehandler`)

The authentication system now automatically handles tenant context:

- Validates JWT tokens from Supabase
- Fetches user profile from database
- **Automatically retrieves user's tenant associations**
- **Uses first tenant as primary tenant** (can be enhanced with default tenant logic)
- Attaches both user and tenant context to request
- **No client-side tenant management required**

### Request Interface

```typescript
interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;        // Database user ID
    supabaseId: string;
    email: string;
    name?: string;
    avatar?: string;
  };
  tenantId: string;    // Primary tenant ID (automatically determined)
  userTenants: Array<{
    id: string;
    name: string;
    isSuperUser: boolean;
  }>;
}
```

## Validation Utilities

### `server/src/utils/tenantValidation.ts`

#### Core Functions

- **`validateUserTenantAccess(userId, tenantId)`**: Validates user belongs to tenant
- **`validateUserSuperAccess(userId, tenantId)`**: Validates user has super user access
- **`getUserTenantIds(userId)`**: Gets all tenant IDs for a user
- **`validateTenantAccessFromSupabaseUser(supabaseId, tenantId)`**: Helper for route handlers

#### Usage Example

```typescript
import { validateUserTenantAccess } from '@/utils/tenantValidation';

// In any service method
await validateUserTenantAccess(userId, tenantId);
```

## Service Layer Changes

### Lead Service (`server/src/modules/lead.service.ts`)

All operations require `userId` and `tenantId` parameters (provided by authentication):

```typescript
// Service method calls (tenantId comes from authenticated request)
await getLeads(userId, tenantId, searchQuery);
await createLead(userId, tenantId, leadData);
await updateLead(userId, tenantId, id, updateData);
await deleteLead(userId, tenantId, id);
```

### Tenant Service (`server/src/modules/tenant.service.ts`)

Added secure methods with validation:

```typescript
// Secure operations
await TenantService.updateTenant(userId, tenantId, updateData);
await TenantService.deleteTenant(userId, tenantId); // Requires super user
await TenantService.getTenantByIdSecure(userId, tenantId);
```

### User Service (`server/src/modules/user.service.ts`)

Added tenant-scoped operations:

```typescript
// Get users by tenant (with validation)
await UserService.getUsersByTenant(requestingUserId, tenantId);
```

## Route Implementation

### Simplified Authentication

All tenant-scoped routes now use single authentication:

```typescript
fastify.route({
  method: 'GET',
  url: '/leads',
  preHandler: [fastify.authPrehandler], // Single authentication layer
  schema: {
    // No X-Tenant-ID header required
    querystring: Type.Object({
      search: Type.Optional(Type.String()),
    }),
    // ... other schema
  },
  handler: async (request: AuthenticatedRequest, reply) => {
    const { user, tenantId } = request;
    // tenantId is automatically determined and validated
    
    const leads = await getLeads(user.id, tenantId, request.query.search);
    reply.send(leads);
  }
});
```

### Updated Routes

#### Lead Routes (`/api/leads`)
- **GET** `/leads` - List leads (automatically tenant-scoped)
- **POST** `/leads` - Create lead (automatically tenant-scoped)
- **GET** `/leads/:id` - Get single lead (automatically tenant-scoped)
- **PUT** `/leads/:id` - Update lead (automatically tenant-scoped)
- **DELETE** `/leads/:id` - Delete lead (automatically tenant-scoped)
- **DELETE** `/leads/bulk` - Bulk delete leads (automatically tenant-scoped)

All routes require only:
- `Authorization: Bearer <jwt_token>` header

## Client Integration

### Simplified Frontend Requirements

Clients only need to include the JWT token:

```typescript
// Example API call - no tenant header needed
const response = await fetch('/api/leads', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Tenant context is automatically handled by the server
```

### Error Handling

The system returns appropriate HTTP status codes:

- **401**: Authentication failed
- **403**: User doesn't have access to tenant/resource or user not associated with any tenant
- **404**: Resource not found in tenant scope

## Security Benefits

### 1. **Automatic Data Isolation**
- Users can only access data within their authorized tenant (automatically determined)
- No possibility of tenant spoofing via headers
- Database queries automatically include tenant filters

### 2. **Simplified Security Model**
- Single authentication layer handles everything
- Server controls tenant context, not client
- Reduced attack surface (no tenant headers to manipulate)

### 3. **Authorization Layers**
- Route-level: Authentication required with automatic tenant resolution
- Service-level: Tenant access validation
- Database-level: Foreign key constraints

### 4. **Audit Trail**
- All operations include user and tenant context
- Logging includes tenant information
- Server-side tenant determination is logged

### 5. **Fail-Safe Design**
- Operations fail if user has no tenant associations
- Operations fail if tenant validation fails
- No tenant access without explicit database association

## Multi-Tenant User Support

### Current Implementation
- Uses first tenant association as primary tenant
- All operations are scoped to this primary tenant

### Future Enhancements
- Add default tenant concept to user profile
- Allow tenant switching via separate API
- Implement tenant selection UI in frontend

## Migration Notes

### From Header-Based to Automatic Tenant Resolution

1. **Removed Requirements**:
   - No `X-Tenant-ID` header needed in requests
   - No client-side tenant context management
   - Simplified CORS configuration

2. **Benefits**:
   - Reduced client complexity
   - Improved security (server-controlled tenant context)
   - Eliminated tenant spoofing vulnerability
   - Cleaner API design

3. **Considerations**:
   - Users with multiple tenants will default to first tenant
   - May need tenant switching functionality in the future
   - Current implementation favors simplicity over multi-tenant flexibility

## Testing

### API Testing

```bash
# Test authentication and automatic tenant scoping
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3001/api/leads

# No X-Tenant-ID header needed - tenant is automatically determined
```

### Error Scenarios

```bash
# Invalid token
curl -H "Authorization: Bearer invalid_token" \
     http://localhost:3001/api/leads
# Returns: 401 Unauthorized

# User with no tenant associations
curl -H "Authorization: Bearer VALID_TOKEN_NO_TENANTS" \
     http://localhost:3001/api/leads  
# Returns: 403 Forbidden - User is not associated with any tenant
```

## Troubleshooting

### Common Issues

1. **403 Forbidden - User not associated with any tenant**
   - Ensure user has been added to at least one tenant via `userTenants` table
   - Check database associations

2. **Authentication failures**
   - Verify JWT token is valid and not expired
   - Ensure Supabase user exists in local database

3. **Service validation errors**
   - Check that service methods are being called with correct userId and tenantId
   - Verify tenant access validation is working

### Debug Logging

The system includes comprehensive logging:

```typescript
// Authentication logs
logger.debug(`User ${dbUser.id} authenticated with primary tenant: ${primaryTenant.tenant.id}`);

// Service operation logs  
logger.info(`Lead created successfully with ID: ${newLead.id} for tenant: ${tenantId}`);
```

## Summary

This implementation provides comprehensive tenant isolation with:

- ✅ **Automatic Data Isolation**
- ✅ **Simplified Security Model**
- ✅ **Authorization Layers**
- ✅ **Audit Trail**
- ✅ **Fail-Safe Design**

All database read and update operations now include proper tenant validation, ensuring users can only access resources within their authorized tenants. 