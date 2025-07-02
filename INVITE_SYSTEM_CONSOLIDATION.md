# Invite System Consolidation

This document summarizes the major architectural changes made to consolidate the invite system by removing redundant tables and simplifying the user invitation flow.

## Overview

The previous system had **three separate tables** managing user-tenant relationships:
- `userTenants` - Core user-tenant relationships with roles
- `invites` - Pending invitations 
- `seats` - Active users (duplicating userTenants data)

This led to inconsistent data storage and complex queries. The new system consolidates everything into a **single `userTenants` table**.

## Changes Made

### 1. Database Schema Changes

**Migration 0005**: `consolidate_user_tenants.sql`
- Added status tracking fields to `userTenants`:
  - `status` - 'pending' (password not set) or 'active' (password set, can login)
  - `invitedAt` - When the user was invited/added
  - `acceptedAt` - When they completed setup/first login
- Migrated existing data from `seats` and `invites` tables to `userTenants`
- Dropped `seats` and `invites` tables

**Updated `userTenants` table structure:**
```sql
user_tenants (
  id,
  userId,          -- FK to users table
  tenantId,        -- FK to tenants table  
  roleId,          -- FK to roles table
  isSuperUser,     -- boolean
  status,          -- 'pending' | 'active' 
  invitedAt,       -- timestamp
  acceptedAt,      -- timestamp
  createdAt,
  updatedAt
)
```

### 2. Server-Side Changes

**Updated Invite Service** (`server/src/modules/invite.service.ts`):
- `createInvite()` - Creates user and userTenant immediately with 'pending' status
- `activateUser()` - Changes status from 'pending' to 'active' when password is set
- `getTenantUsers()` - Single query to get all users for a tenant
- `removeUser()` - Removes user from tenant (deletes userTenant record)
- `resendInvite()` - Updates invite timestamp and resends setup email

**Updated Invite Routes** (`server/src/routes/invite.routes.ts`):
- `/invites/verify` - Verifies user token and returns userTenant data
- `/invites/activate` - Activates user account (replaces accept)
- `/users/:userId/resend` - Resends invitation (updated URL structure)  
- `/users/:userId` DELETE - Removes user from tenant

**Updated Invite Handlers** (`server/src/modules/invite.handlers.ts`):
- `createNewUserInvite()` - Creates Supabase user and database records immediately
- Simplified flow removes complex invite acceptance logic

### 3. Client-Side Changes

**Updated Invite Service** (`client/src/services/invites.service.ts`):
- `activateUser()` - Replaces `acceptInvite()`
- `removeUser()` - Replaces `revokeInvite()`
- `resendInvite()` - Updated to use userId instead of inviteId
- Updated interfaces to remove 'expired' status

**Updated Router** (`client/src/router.tsx`):
- Changed route from `/accept-invite` to `/auth/setup-password`
- Removed `AcceptInvitePage` component (no longer needed)
- Uses existing `SetupPassword` component

**Updated Users Page** (`client/src/pages/settings/UsersPage.tsx`):
- Updated to use `removeUser()` instead of `revokeInvite()`
- Removed 'expired' status from status badge
- Updated button text and tooltips

### 4. New User Invitation Flow

**Before** (Complex):
1. Admin invites user → Creates `invites` record
2. User gets email with invite link  
3. User clicks link → Verifies invite
4. User accepts → Creates Supabase user + `users` record + `seats` record
5. Separate `userTenants` table exists but isn't used consistently

**After** (Simplified):
1. Admin invites user → Creates Supabase user + `users` record + `userTenants` record (status: 'pending')
2. User gets email with setup password link
3. User sets password → Status changes to 'active'
4. User can immediately login and access the system

## Benefits

1. **Single Source of Truth**: All user-tenant relationships in one table
2. **Simplified Queries**: No need to merge data from multiple tables
3. **Consistent Data**: Same logical relationship stored the same way regardless of how user joined
4. **Immediate User Creation**: Users exist in the system immediately when invited
5. **Cleaner Architecture**: Removes redundant tables and complex merging logic
6. **Better Performance**: Fewer joins and queries needed

## API Compatibility

The changes maintain backward compatibility for:
- User creation and management
- Role assignments  
- Tenant operations

New API endpoints:
- `POST /api/invites/activate` (replaces `/api/invites/accept`)
- `POST /api/users/:userId/resend` (replaces `/api/invites/:inviteId/resend`)
- `DELETE /api/users/:userId` (replaces `/api/invites/:inviteId`)

## Status Values

The system now uses only two user statuses:
- `pending` - User created but hasn't set password yet
- `active` - User has set password and can login

Removed statuses:
- `expired` - No longer needed as users are created immediately

## Migration Notes

- All existing invite and seat data is preserved and migrated to userTenants
- Users who had pending invites are created immediately with 'pending' status
- Users who had accepted invites are marked as 'active'
- No data loss occurs during migration 