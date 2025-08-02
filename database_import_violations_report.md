# Database Import Violations Report

## Summary
This report identifies all files in the `server/` directory that are importing database components directly instead of using the repository pattern. All database access should be contained within the `server/src/repositories/` directory.

## Violations Found

### 1. Schema Type Imports (Type-only violations)
These files are importing database schema types for TypeScript type definitions:

#### `server/src/modules/leadProduct.service.ts`
- **Line 2**: `import type { LeadProduct } from '../db/schema';`
- **Impact**: Type import only
- **Recommendation**: Move type definitions to a shared types file or import from repository

#### `server/src/modules/lead.service.ts` 
- **Line 9**: `import { NewLead, NewLeadPointOfContact, Lead, LeadPointOfContact, LeadStatus } from '../db/schema';`
- **Impact**: Type imports only
- **Recommendation**: Move type definitions to a shared types file or import from repository

#### `server/src/routes/lead.routes.ts`
- **Line 22**: `import { NewLead } from '../db/schema';`
- **Impact**: Type import only
- **Recommendation**: Move type definitions to a shared types file or import from repository

#### `server/src/modules/products.service.ts`
- **Line 3**: `import type { Product, NewProduct } from '../db/schema';`
- **Impact**: Type import only
- **Recommendation**: Move type definitions to a shared types file or import from repository

#### `server/src/modules/contact.service.ts`
- **Line 1**: `import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';`
- **Impact**: Type import only
- **Recommendation**: Move type definitions to a shared types file or import from repository

#### `server/src/modules/ai/contactExtraction.service.ts`
- **Line 3**: `import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';`
- **Impact**: Type import only
- **Recommendation**: Move type definitions to a shared types file or import from repository

### 2. Direct Database Access Violations (Critical)
These files are directly accessing the database outside of repositories:

#### `server/src/fix-role-defaults.ts`
- **Line 1**: `import { eq, isNull } from 'drizzle-orm';`
- **Line 2**: `import { db } from './db/index';`
- **Line 3**: `import { roles, userTenants } from './db/schema';`
- **Impact**: CRITICAL - Direct database access and ORM usage
- **Recommendation**: Move this script to use repository pattern or move to a database migration/seed script

#### `server/src/utils/tenantValidation.ts`
- **Line 1**: `import { eq, and } from 'drizzle-orm';`
- **Line 2**: `import { db, userTenants, users } from '@/db';`
- **Impact**: CRITICAL - Direct database access in utility function
- **Recommendation**: Create a repository method for tenant validation or move logic to existing UserTenantRepository

#### `server/src/modules/ai/langchain/tools/GetInformationAboutDomainTool.ts`
- **Line 2**: `import { sql, eq } from 'drizzle-orm';`
- **Line 4**: `import db from '@/libs/drizzleClient';`
- **Line 5**: `import { siteEmbeddings, siteEmbeddingDomains } from '@/db/schema';`
- **Impact**: CRITICAL - Direct database access in AI tool
- **Recommendation**: Use SiteEmbeddingRepository and SiteEmbeddingDomainRepository

#### `server/src/modules/ai/langchain/tools/ListDomainPagesTool.ts`
- **Line 3**: `import { eq } from 'drizzle-orm';`
- **Line 4**: `import { db, siteEmbeddingDomains, siteEmbeddings } from '@/db';`
- **Impact**: CRITICAL - Direct database access in AI tool
- **Recommendation**: Use SiteEmbeddingRepository and SiteEmbeddingDomainRepository

#### `server/src/modules/ai/langchain/tools/RetrieveFullPageTool.ts`
- **Line 3**: `import { eq } from 'drizzle-orm';`
- **Line 4**: `import { db, siteEmbeddings } from '@/db';`
- **Impact**: CRITICAL - Direct database access in AI tool
- **Recommendation**: Use SiteEmbeddingRepository

## Severity Breakdown

### Critical Violations (5 files)
Files that directly access the database bypassing the repository pattern:
1. `server/src/fix-role-defaults.ts`
2. `server/src/utils/tenantValidation.ts`
3. `server/src/modules/ai/langchain/tools/GetInformationAboutDomainTool.ts`
4. `server/src/modules/ai/langchain/tools/ListDomainPagesTool.ts`
5. `server/src/modules/ai/langchain/tools/RetrieveFullPageTool.ts`

### Type-only Violations (6 files)
Files that only import types from schema (lower priority but still against pattern):
1. `server/src/modules/leadProduct.service.ts`
2. `server/src/modules/lead.service.ts`
3. `server/src/routes/lead.routes.ts`
4. `server/src/modules/products.service.ts`
5. `server/src/modules/contact.service.ts`
6. `server/src/modules/ai/contactExtraction.service.ts`

## Existing Repository Structure
The following repositories are properly implemented and should be used:
- `LeadRepository`
- `LeadPointOfContactRepository`
- `LeadProductRepository`
- `LeadStatusRepository`
- `ProductRepository`
- `SiteEmbeddingRepository`
- `SiteEmbeddingDomainRepository`
- `UserRepository`
- `UserTenantRepository`
- `TenantRepository`
- `RoleRepository`
- `PermissionRepository`
- `RolePermissionRepository`

## Recommendations

### Immediate Actions (Critical fixes)
1. **Fix tenant validation**: Move `tenantValidation.ts` logic to `UserTenantRepository`
2. **Fix AI tools**: Update all langchain tools to use `SiteEmbeddingRepository` methods
3. **Fix role defaults script**: Either move to proper migration or use repository pattern

### Type System Improvements
1. Create a shared types package/file that exports database schema types
2. Update all service files to import types from the shared location
3. Consider creating DTOs (Data Transfer Objects) to decouple API types from database schema

### Pattern Enforcement
1. Add ESLint rules to prevent direct imports from `@/db` outside of repositories
2. Add pre-commit hooks to catch these violations
3. Update team documentation to clarify the repository pattern requirements

## Total Files Requiring Fixes: 11
- **Critical fixes**: 5 files
- **Type import fixes**: 6 files