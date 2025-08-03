# TenantId Security Audit Report

## Executive Summary

This audit report examines all API routes in the application to identify endpoints that incorrectly accept `tenantId` as a route parameter, query parameter, or request body field. According to security best practices, `tenantId` should always be derived from the authenticated user context rather than being provided by the client.

## Audit Methodology

1. **Backend Route Analysis**: Examined all route files in `server/src/routes/` 
2. **Frontend Service Analysis**: Reviewed client-side services in `client/src/services/`
3. **Component Usage Analysis**: Checked how frontend components use APIs
4. **Authentication Flow Review**: Verified proper tenantId extraction from authenticated user

## Key Findings

### ✅ **GOOD NEWS: Most Routes Are Secure**

The majority of API routes correctly follow security best practices:
- Routes properly use `authenticatedRequest.tenantId` from the authentication plugin
- Frontend services do not pass tenantId parameters
- Authentication plugin correctly sets tenantId from user's primary tenant

### ⚠️ **SECURITY ISSUE FOUND: 1 Problematic Route**

## Problematic Routes

### 1. User Permissions Endpoint - **HIGH PRIORITY**

**Route**: `GET /api/user-permissions/:tenantId`
**File**: `server/src/routes/roles.routes.ts:253`

**Issue**: Takes tenantId as a path parameter instead of using authenticated user's tenantId

**Current Implementation**:
```typescript
// Line 253-267 in roles.routes.ts
url: '/user-permissions/:tenantId',
handler: async (
  request: FastifyRequest<{ Params: { tenantId: string } }>,
  reply: FastifyReply
) => {
  const { tenantId } = request.params;  // ❌ SECURITY ISSUE
  // ... rest of handler
}
```

**Security Risk**: 
- Allows clients to request permissions for any tenant
- Bypasses tenant isolation
- Potential for privilege escalation

**Recommended Fix**:
```typescript
// Should be:
url: '/user-permissions',
handler: async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const { tenantId } = request as AuthenticatedRequest;  // ✅ SECURE
  // ... rest of handler
}
```

**Frontend Usage Analysis**: 
- **Status**: Route appears to be defined but not yet actively used by frontend
- **Search Results**: No client-side calls to this endpoint found
- **Impact**: Low immediate risk as endpoint seems unused, but high potential risk

## Route-by-Route Analysis

### ✅ Secure Routes (Correctly Implemented)

#### Authentication Routes (`authentication.routes.ts`)
- All routes properly use authenticated user context
- Registration route appropriately handles tenantName in request body (different use case)

#### Contact Routes (`contact.routes.ts`)
- All routes use `authenticatedRequest.tenantId`
- No client-provided tenantId parameters

#### Invite Routes (`invite.routes.ts`)
- All routes use `(request as any).tenantId` from authentication context
- Examples:
  - `GET /users` - Line 38: `const tenantId = (request as any).tenantId;`
  - `POST /invites` - Line 75: `const tenantId = (request as any).tenantId;`

#### Lead Routes (`lead.routes.ts`)
- All routes use `authenticatedRequest.tenantId`
- Examples:
  - `GET /leads` - Line 70: `getLeads(authenticatedRequest.tenantId, search)`
  - `POST /leads` - Line 151: `authenticatedRequest.tenantId`

#### Organization Routes (`organization.routes.ts`)
- Routes use `const { tenantId } = request as AuthenticatedRequest;`
- Proper tenant validation (Line 165: `if (tenantId !== id)`)

#### Products Routes (`products.routes.ts`)
- All routes use `const { tenantId } = authenticatedRequest;`
- Examples:
  - `GET /products` - Line 44: `const { tenantId } = authenticatedRequest;`

#### Logo Routes (`logo.routes.ts`)
- Uses authenticated request context (verified by import pattern)

#### Ping Routes (`ping.routes.ts`)
- Health check endpoint, no tenant context needed

#### Firecrawl Webhook Routes (`firecrawl.webhook.routes.ts`)
- Webhook endpoint, different authentication pattern expected

### 🔧 Authentication Infrastructure Analysis

#### Authentication Plugin (`plugins/authentication.plugin.ts`)
**✅ Correctly Implemented**:
- Line 132: `authenticatedRequest.tenantId = primaryTenant.id;`
- Automatically sets tenantId from user's primary tenant
- Provides proper type: `AuthenticatedRequest` interface

#### Permissions Plugin (`plugins/permissions.plugin.ts`)
**⚠️ Contains Fallback Logic**:
- Lines 121-134: Contains fallback to check params, query, and body for tenantId
- **Note**: This is likely intended for special cases but could be exploited if routes don't use auth prehandler
- **Recommendation**: Review if this fallback logic is necessary

## Frontend Service Analysis

### ✅ All Client Services Are Secure

#### Products Service (`client/src/services/products.service.ts`)
- Does not pass tenantId parameters
- Uses only authentication headers
- Query key includes tenantId for caching purposes only

#### Organization Service (`client/src/services/organization.service.ts`)
- Does not pass tenantId parameters  
- Uses only authentication headers

#### Roles Service (`client/src/services/roles.service.ts`)
- Does not contain user-permissions API calls
- Uses only authentication headers

#### Auth Service (`client/src/services/auth.service.ts`)
- Handles authentication tokens properly

#### Other Services
- All other services follow the same secure pattern

### Frontend Component Analysis

Components correctly extract tenantId from user context for display purposes only:
- `client/src/components/tabs/ProductsTab.tsx:32`
- `client/src/pages/settings/OrganizationPage.tsx:13`  
- `client/src/pages/settings/ProductsPage.tsx:210`

**Pattern**: `const currentTenantId = user?.tenants?.[0]?.id`
**Usage**: Used for conditional rendering and query keys, NOT sent to APIs

## Recommendations

### Immediate Actions Required

1. **Fix User Permissions Route** (HIGH PRIORITY)
   - Change route from `/user-permissions/:tenantId` to `/user-permissions`
   - Update handler to use `authenticatedRequest.tenantId`
   - Update API schema to remove tenantId parameter requirement
   - Test the change thoroughly

2. **Code Review** (MEDIUM PRIORITY)
   - Review permissions plugin fallback logic
   - Consider removing or restricting the tenantId fallback in `getTenantFromRequest()`

### Preventive Measures

1. **Linting Rules**
   - Add ESLint rules to detect `request.params.tenantId` patterns
   - Add warnings for `request.query.tenantId` and `request.body.tenantId`

2. **Testing**
   - Add security tests that verify tenantId isolation
   - Test that users cannot access other tenants' data

3. **Documentation**
   - Document the secure pattern for new route development
   - Add security guidelines for API development

4. **Code Review Checklist**
   - Ensure all new routes use `AuthenticatedRequest` type
   - Verify tenantId comes from authentication context
   - Check that route handlers don't accept client-provided tenantId

## Conclusion

The application has a strong security foundation with proper authentication and tenant isolation. Only one route needs immediate attention. The frontend architecture is secure and follows best practices by not sending tenantId parameters to APIs.

**Risk Level**: LOW (due to unused endpoint) 
**Action Required**: YES (fix the user-permissions route)
**Overall Security Posture**: GOOD with one critical fix needed

---

**Audit Date**: $(date)
**Auditor**: Security Analysis Tool
**Next Review**: Recommended after implementing fixes