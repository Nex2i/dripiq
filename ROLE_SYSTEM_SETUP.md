# 🚀 Role System Integration Setup Guide

This guide provides step-by-step instructions to integrate the newly implemented role-based access control system into your DripIQ application.

## ✅ Implementation Complete

The following components have been implemented:

- ✅ **Database Schema**: Added `roles`, `permissions`, `role_permissions` tables and updated `user_tenants`
- ✅ **Role Service**: Complete role and permission management service
- ✅ **Permission Middleware**: Route-level permission checking
- ✅ **API Routes**: Full CRUD operations for roles and permissions
- ✅ **Database Seeding**: Admin and Sales roles with predefined permissions
- ✅ **Authentication Integration**: Updated user registration to include roles
- ✅ **Documentation**: Comprehensive system documentation

## 🔧 Required Integration Steps

### 1. Database Setup

```bash
# Navigate to server directory
cd server

# Install dependencies (if not already done)
npm install

# Configure environment variables
cp .example.env .env
# Edit .env with your database credentials

# Generate and run migration
npm run db:generate
npm run db:migrate

# Seed the database with roles and permissions
npm run db:seed
```

### 2. Register Plugins in FastiFy App

Edit `server/src/app.ts` to register the permissions plugin:

```typescript
// Add to imports
import permissionsPlugin from './plugins/permissions.plugin';

// Add to plugin registration (after authentication plugin)
await app.register(permissionsPlugin);
```

### 3. Register Role Routes

Edit your main route registration file to include role routes:

```typescript
// Add to imports
import rolesRoutes from './routes/roles.routes';

// Add to route registration
await app.register(rolesRoutes, { prefix: '/api' });
```

### 4. Update Database Exports

Edit `server/src/db/index.ts` to export new schema elements:

```typescript
// Add to existing exports
export {
  // ... existing exports
  roles,
  permissions,
  rolePermissions,
  type Role,
  type Permission,
  type RolePermission,
  type NewRole,
  type NewPermission,
  type NewRolePermission,
} from './schema';
```

### 5. Add Type Declarations

Ensure `server/src/types/fastify.d.ts` includes the new methods:

```typescript
declare module 'fastify' {
  interface FastifyInstance {
    authPrehandler: preHandlerHookHandler;
    userService: typeof UserService; // Add this if not exists
    requirePermission: (resource: string, action: string) => preHandlerHookHandler;
    requireAdmin: () => preHandlerHookHandler;
  }
}
```

## 🎯 Usage Examples

### Protecting Routes with Permissions

```typescript
// Require specific permission
fastify.route({
  method: 'POST',
  url: '/campaigns',
  preHandler: [
    fastify.authPrehandler,
    fastify.requirePermission('campaigns', 'create')
  ],
  handler: async (request, reply) => {
    // Only users with campaigns:create permission can access
  }
});

// Require admin access
fastify.route({
  method: 'DELETE',
  url: '/users/:userId',
  preHandler: [
    fastify.authPrehandler,
    fastify.requireAdmin()
  ],
  handler: async (request, reply) => {
    // Only admins can access
  }
});
```

### Checking Permissions in Service Logic

```typescript
import { RoleService } from '@/modules/role.service';

// Check if user can perform action
const canManageUsers = await RoleService.userHasPermission(
  userId,
  tenantId,
  'users',
  'manage'
);

if (canManageUsers) {
  // Perform user management operation
}

// Check admin status
const isAdmin = await RoleService.userIsAdmin(userId, tenantId);
```

## 🌱 Default Roles and Permissions

### Admin Role (24 permissions)
- **Campaigns**: Full CRUD access
- **Leads**: Full CRUD access  
- **Users**: Full CRUD access
- **Analytics**: Read access
- **Settings**: Full management
- **Roles**: Full management

### Sales Role (8 permissions)
- **Campaigns**: Create, read, update
- **Leads**: Create, read, update
- **Analytics**: Read access
- **Settings**: Read access

## 🔒 Security Features

### Tenant Isolation
- All permissions are scoped to specific tenants
- Users can have different roles in different tenants
- Cross-tenant access is automatically prevented

### Multi-Level Authorization
1. **Authentication**: User must be logged in (JWT token)
2. **Authorization**: User must have required permissions
3. **Tenant Access**: User must belong to the tenant

### Permission Hierarchy
- **Super Users**: Bypass all permission checks within their tenant
- **Role-Based**: Standard permission checking based on assigned role
- **Granular**: Specific resource:action combinations

## 🔄 User Registration Flow

The registration process now includes role assignment:

1. User provides registration details
2. Supabase user account is created
3. Database user record is created
4. Tenant is created (for new organizations)
5. **NEW**: Admin role is assigned to the user
6. User-tenant relationship is established with role
7. Authentication session is created

## 📊 Frontend Integration

### User Context with Roles

```typescript
// Updated user context type
interface UserContext {
  user: User;
  tenants: Array<{
    id: string;
    name: string;
    isSuperUser: boolean;
    role: {
      id: string;
      name: string;
      permissions: Permission[];
    } | null;
  }>;
}
```

### Permission Checking Hook

```typescript
const usePermission = (resource: string, action: string) => {
  const { currentTenant } = useContext(UserContext);
  
  return currentTenant?.role?.permissions?.some(
    permission => permission.resource === resource && permission.action === action
  ) || false;
};

// Usage
const CreateCampaignButton = () => {
  const canCreateCampaigns = usePermission('campaigns', 'create');
  
  if (!canCreateCampaigns) {
    return null; // Hide button for unauthorized users
  }
  
  return <Button>Create Campaign</Button>;
};
```

## 🚨 Important Notes

### Existing Users
- Existing users in the database will need role assignment
- Run a data migration script to assign default roles
- Consider grandfathering existing users as Admins

### Testing
- Test permission checks thoroughly
- Verify tenant isolation works correctly
- Ensure super user override functions properly

### Performance
- Role/permission checks add database queries
- Consider caching user permissions
- Monitor performance impact on high-traffic routes

## 🔧 Troubleshooting

### Common Issues

**"Admin role not found" during registration**
```bash
# Ensure roles are seeded
npm run db:seed
```

**Permission denied for existing operations**
```bash
# Check if user has been assigned a role
# Use the user permissions endpoint to debug
```

**Middleware not working**
```typescript
// Ensure plugins are registered in correct order
// Authentication must come before permissions
```

### Debug Commands

```bash
# Check database schema
npm run db:introspect

# View current roles and permissions
# Use API endpoints or database queries

# Test role system without database
npm run test:roles  # (if you create this script)
```

## 🎉 Verification Checklist

- [ ] Database migration completed successfully
- [ ] Roles and permissions seeded correctly
- [ ] Plugins registered in FastiFy app
- [ ] Role routes accessible via API
- [ ] New user registration assigns Admin role
- [ ] Permission middleware blocks unauthorized access
- [ ] Frontend can check user permissions
- [ ] Documentation is accessible to team

## 🚀 Next Steps

1. **Deploy to staging environment**
2. **Test with real user scenarios**
3. **Train team on new permission system**
4. **Monitor system performance**
5. **Gather feedback and iterate**

---

The role system is now ready for production use! 🎯