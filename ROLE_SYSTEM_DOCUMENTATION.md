# 🔐 Role-Based Access Control System

## Overview

The DripIQ platform now includes a comprehensive role-based access control (RBAC) system that provides fine-grained permissions for different user types. The system is designed to support Admin and Sales roles with specific capabilities aligned to their business needs.

## 🎯 Role Definitions

### Admin Role
**Full system access with management capabilities**

**Permissions:**
- **View all campaigns and manage users** - Complete oversight of campaign activities
- **Full CRUD operations** on campaigns, leads, users, and system settings
- **Analytics access** - View all performance metrics and reports
- **System configuration** - Manage roles, permissions, and system settings
- **User management** - Create, update, and delete user accounts
- **Role management** - Assign and modify user roles

**Use Cases:**
- Sales managers and directors
- Revenue operations teams
- System administrators
- Account executives with leadership responsibilities

### Sales Role
**Campaign creation and lead management access**

**Permissions:**
- **Setup new campaigns** - Create and configure marketing campaigns
- **Add leads** - Import and manage prospect information
- **Update campaigns** - Modify their own campaign settings
- **View analytics** - Access performance reports and metrics
- **Basic settings access** - View system configuration (read-only)

**Use Cases:**
- Account executives
- Sales representatives
- Business development representatives
- Campaign managers

## 🏗️ Technical Architecture

### Database Schema

#### Core Tables

**`roles`**
```sql
- id (primary key)
- name (unique) - 'Admin', 'Sales'
- description
- created_at, updated_at
```

**`permissions`**
```sql
- id (primary key)
- name (unique) - e.g., 'campaigns:create'
- description
- resource - 'campaigns', 'leads', 'users', etc.
- action - 'create', 'read', 'update', 'delete', 'manage'
- created_at, updated_at
```

**`role_permissions`** (Many-to-Many)
```sql
- id (primary key)
- role_id (foreign key to roles)
- permission_id (foreign key to permissions)
- created_at
```

**`user_tenants`** (Updated)
```sql
- id (primary key)
- user_id (foreign key to users)
- tenant_id (foreign key to tenants)
- role_id (foreign key to roles) - NEW
- is_super_user (boolean)
- created_at, updated_at
```

### Permission System

#### Permission Naming Convention
Permissions follow the format: `{resource}:{action}`

**Resources:**
- `campaigns` - Marketing campaigns
- `leads` - Prospect management
- `users` - User account management
- `analytics` - Reports and metrics
- `settings` - System configuration
- `roles` - Role and permission management

**Actions:**
- `create` - Add new records
- `read` - View existing records
- `update` - Modify existing records
- `delete` - Remove records
- `manage` - Full CRUD access

#### Example Permissions
```
campaigns:create  - Create new campaigns
campaigns:read    - View campaigns
leads:manage      - Full lead management
users:delete      - Delete user accounts
analytics:read    - View reports
settings:update   - Modify system settings
```

## 🚀 API Endpoints

### Role Management

#### Get All Roles
```http
GET /api/roles
Authorization: Bearer {token}
```

#### Get Role with Permissions
```http
GET /api/roles/{roleId}
Authorization: Bearer {token}
```

#### Create Role (Admin Only)
```http
POST /api/roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Custom Role",
  "description": "Custom role description"
}
```

#### Get All Permissions
```http
GET /api/permissions
Authorization: Bearer {token}
```

#### Create Permission (Admin Only)
```http
POST /api/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "custom:action",
  "description": "Custom permission",
  "resource": "custom",
  "action": "action"
}
```

#### Assign Permission to Role (Admin Only)
```http
POST /api/roles/{roleId}/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "permissionId": "permission-uuid"
}
```

#### Get User Permissions
```http
GET /api/user-permissions/{tenantId}
Authorization: Bearer {token}
```

### Permission Checking

#### Middleware Usage
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
    // Create campaign logic
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
    // Delete user logic
  }
});
```

## 🔧 Implementation Guide

### 1. Database Migration

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:migrate

# Seed roles and permissions
npm run db:seed
```

### 2. Service Usage

```typescript
import { RoleService } from '@/modules/role.service';

// Check user permission
const hasPermission = await RoleService.userHasPermission(
  userId,
  tenantId,
  'campaigns',
  'create'
);

// Check if user is admin
const isAdmin = await RoleService.userIsAdmin(userId, tenantId);

// Get user permissions
const userPermissions = await RoleService.getUserPermissions(userId, tenantId);
```

### 3. Frontend Integration

```typescript
// User context with role information
interface UserContext {
  user: User;
  tenants: Array<{
    id: string;
    name: string;
    role: {
      id: string;
      name: string;
      permissions: Permission[];
    };
  }>;
}

// Permission checking hook
const usePermission = (resource: string, action: string) => {
  const { currentTenant } = useContext(UserContext);
  
  return currentTenant?.role?.permissions?.some(
    permission => permission.resource === resource && permission.action === action
  ) || false;
};

// Usage in components
const CreateCampaignButton = () => {
  const canCreateCampaigns = usePermission('campaigns', 'create');
  
  if (!canCreateCampaigns) {
    return null;
  }
  
  return <Button>Create Campaign</Button>;
};
```

## 🔒 Security Features

### 1. Tenant Isolation
- All permissions are scoped to specific tenants
- Users can have different roles in different tenants
- Cross-tenant access is prevented

### 2. Multi-Level Authorization
- **Authentication:** User must be logged in
- **Authorization:** User must have required permissions
- **Tenant Access:** User must belong to the tenant

### 3. Super User Override
- Super users bypass permission checks within their tenant
- Only granted during registration or by other super users
- Provides emergency access and system administration

### 4. Permission Middleware
- Automatic permission checking at the route level
- Centralized permission logic
- Consistent error responses

## 📊 Default Role Configuration

### Admin Permissions (24 total)
```
campaigns:create, campaigns:read, campaigns:update, campaigns:delete, campaigns:manage
leads:create, leads:read, leads:update, leads:delete, leads:manage
users:create, users:read, users:update, users:delete, users:manage
analytics:read
settings:read, settings:update, settings:manage
roles:create, roles:read, roles:update, roles:delete, roles:manage
```

### Sales Permissions (8 total)
```
campaigns:create, campaigns:read, campaigns:update
leads:create, leads:read, leads:update
analytics:read
settings:read
```

## 🚀 Usage Examples

### Creating a Campaign (Sales Role)
```typescript
// ✅ Allowed - Sales can create campaigns
POST /api/campaigns
{
  "name": "Q1 Outreach Campaign",
  "tenantId": "tenant-123"
}
```

### Managing Users (Admin Only)
```typescript
// ✅ Admin can create users
POST /api/users
{
  "email": "new-sales@company.com",
  "roleId": "sales-role-id",
  "tenantId": "tenant-123"
}

// ❌ Sales cannot create users - 403 Forbidden
```

### Viewing Analytics (Both Roles)
```typescript
// ✅ Both Admin and Sales can view analytics
GET /api/analytics?tenantId=tenant-123
```

## 🔧 Extending the System

### Adding New Roles
1. Create role using the API or seed file
2. Define permissions for the role
3. Assign permissions using role-permission endpoints
4. Update frontend permission checks

### Adding New Permissions
1. Define permission with resource and action
2. Add to appropriate roles
3. Implement permission checks in routes
4. Update frontend components

### Custom Permission Logic
```typescript
// Custom permission checking
const hasCustomAccess = async (userId: string, tenantId: string) => {
  const userPermissions = await RoleService.getUserPermissions(userId, tenantId);
  
  // Custom business logic
  return userPermissions?.roleName === 'Admin' || 
         (userPermissions?.roleName === 'Sales' && someCondition);
};
```

## 🎯 Best Practices

1. **Principle of Least Privilege:** Grant minimum necessary permissions
2. **Resource-Based Permissions:** Use specific resource/action combinations
3. **Tenant Scoping:** Always include tenant context in permission checks
4. **Frontend Validation:** Hide UI elements users cannot access
5. **Backend Enforcement:** Always validate permissions on the server
6. **Audit Trail:** Log permission changes and access attempts
7. **Regular Review:** Periodically review and update role permissions

## 🔍 Troubleshooting

### Common Issues

**"Admin role not found" during registration:**
```bash
# Ensure roles are seeded
npm run db:seed
```

**Permission denied errors:**
```typescript
// Check user role assignment
const userPermissions = await RoleService.getUserPermissions(userId, tenantId);
console.log('User permissions:', userPermissions);
```

**Missing tenant context:**
```typescript
// Ensure tenant ID is provided in request
// Check headers, params, query, or body for tenantId
```

## 📈 Monitoring and Analytics

Track role usage and permission effectiveness:
- Monitor failed permission checks
- Analyze role distribution across tenants
- Track permission usage patterns
- Identify potential security issues

---

This role system provides a robust foundation for managing user access while maintaining flexibility for future business requirements and scaling needs.