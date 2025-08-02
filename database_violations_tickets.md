# Database Import Violations - Individual Tickets

## Critical Priority Tickets

### TICKET-001: Fix Tenant Validation Direct Database Access
**Priority**: Critical  
**Estimated Effort**: Medium  
**Files**: `server/src/utils/tenantValidation.ts`

**AI Prompt:**
```
Refactor the tenant validation utility to use the repository pattern instead of direct database access. 

Current file: server/src/utils/tenantValidation.ts
Issue: The file directly imports and uses drizzle-orm and database connection, bypassing the repository pattern.

Requirements:
1. Remove direct imports: `import { eq, and } from 'drizzle-orm'` and `import { db, userTenants, users } from '@/db'`
2. Use the existing UserTenantRepository from `@/repositories` instead
3. If needed functionality doesn't exist in UserTenantRepository, add appropriate methods there first
4. Maintain the same function signatures and behavior for validateUserTenantAccess
5. Ensure all error handling remains the same
6. Update any imports to use repository methods instead of direct database queries

The goal is to eliminate all direct database access from this utility file while preserving its functionality.
```

---

### TICKET-002: Fix Role Defaults Script Database Access
**Priority**: Critical  
**Estimated Effort**: Medium  
**Files**: `server/src/fix-role-defaults.ts`

**AI Prompt:**
```
Refactor the role defaults script to use the repository pattern instead of direct database access.

Current file: server/src/fix-role-defaults.ts
Issue: The file directly imports and uses drizzle-orm, database connection, and schema, bypassing the repository pattern.

Requirements:
1. Remove direct imports: `import { eq, isNull } from 'drizzle-orm'`, `import { db } from './db/index'`, and `import { roles, userTenants } from './db/schema'`
2. Use existing repositories: RoleRepository and UserTenantRepository from `@/repositories`
3. If needed functionality doesn't exist in the repositories, add appropriate methods there first
4. Maintain the same script behavior and console logging
5. Ensure all database operations go through repository methods
6. Keep the async function structure and error handling

Alternative: If this is meant to be a one-time migration script, consider moving it to a proper database migration folder and documenting it as such.
```

---

### TICKET-003: Fix GetInformationAboutDomainTool Database Access
**Priority**: Critical  
**Estimated Effort**: Medium  
**Files**: `server/src/modules/ai/langchain/tools/GetInformationAboutDomainTool.ts`

**AI Prompt:**
```
Refactor the GetInformationAboutDomainTool to use repository pattern instead of direct database access.

Current file: server/src/modules/ai/langchain/tools/GetInformationAboutDomainTool.ts
Issue: The file directly imports and uses drizzle-orm, database connection, and schema tables.

Requirements:
1. Remove direct imports: `import { sql, eq } from 'drizzle-orm'`, `import db from '@/libs/drizzleClient'`, and `import { siteEmbeddings, siteEmbeddingDomains } from '@/db/schema'`
2. Use existing repositories: SiteEmbeddingRepository and SiteEmbeddingDomainRepository from `@/repositories`
3. The tool currently does vector similarity search with embeddings - if this functionality doesn't exist in the repositories, add appropriate methods there first
4. Maintain the exact same tool functionality and response format
5. Preserve the TOP_K constant and embedding similarity logic
6. Ensure the tool still works with the LangChain framework properly
7. Keep all the existing input/output schemas and descriptions

Focus on moving the database query logic into repository methods while preserving the AI tool's behavior.
```

---

### TICKET-004: Fix ListDomainPagesTool Database Access
**Priority**: Critical  
**Estimated Effort**: Small  
**Files**: `server/src/modules/ai/langchain/tools/ListDomainPagesTool.ts`

**AI Prompt:**
```
Refactor the ListDomainPagesTool to use repository pattern instead of direct database access.

Current file: server/src/modules/ai/langchain/tools/ListDomainPagesTool.ts
Issue: The file directly imports and uses drizzle-orm and database components.

Requirements:
1. Remove direct imports: `import { eq } from 'drizzle-orm'` and `import { db, siteEmbeddingDomains, siteEmbeddings } from '@/db'`
2. Use existing repositories: SiteEmbeddingRepository and SiteEmbeddingDomainRepository from `@/repositories`
3. If needed functionality doesn't exist in the repositories, add appropriate methods there first
4. Maintain the exact same tool functionality - listing all pages for a domain
5. Preserve the tool's input/output schemas and descriptions
6. Ensure the tool still works with the LangChain framework properly
7. Keep all error handling and response formatting

The tool should continue to return the same data structure but obtain it through repository methods.
```

---

### TICKET-005: Fix RetrieveFullPageTool Database Access
**Priority**: Critical  
**Estimated Effort**: Small  
**Files**: `server/src/modules/ai/langchain/tools/RetrieveFullPageTool.ts`

**AI Prompt:**
```
Refactor the RetrieveFullPageTool to use repository pattern instead of direct database access.

Current file: server/src/modules/ai/langchain/tools/RetrieveFullPageTool.ts
Issue: The file directly imports and uses drizzle-orm and database components.

Requirements:
1. Remove direct imports: `import { eq } from 'drizzle-orm'` and `import { db, siteEmbeddings } from '@/db'`
2. Use existing SiteEmbeddingRepository from `@/repositories`
3. If needed functionality doesn't exist in the repository, add appropriate methods there first
4. Maintain the exact same tool functionality - retrieving full page content by URL
5. Preserve the tool's input/output schemas and descriptions
6. Ensure the tool still works with the LangChain framework properly
7. Keep all error handling and response formatting

The tool should continue to return the same page content but obtain it through repository methods.
```

---

## Type Import Cleanup Tickets

### TICKET-006: Create Shared Database Types
**Priority**: Medium  
**Estimated Effort**: Small  
**Files**: New file `server/src/types/database.ts`

**AI Prompt:**
```
Create a shared types file for database schema types to eliminate direct schema imports across the codebase.

Task: Create server/src/types/database.ts

Requirements:
1. Export all commonly used database types from the schema
2. Include these specific types that are imported across multiple files:
   - LeadProduct
   - NewLead, Lead, LeadPointOfContact, NewLeadPointOfContact, LeadStatus
   - Product, NewProduct
3. Import these types from '@/db/schema' in this single file
4. Add proper TypeScript type exports
5. Add JSDoc comments explaining the purpose of each type
6. Ensure this file becomes the single source of truth for database types used outside repositories

This will be used in subsequent tickets to replace direct schema imports across service files.
```

---

### TICKET-007: Fix LeadProduct Service Type Imports
**Priority**: Low  
**Estimated Effort**: Small  
**Files**: `server/src/modules/leadProduct.service.ts`

**AI Prompt:**
```
Update leadProduct service to use shared database types instead of direct schema imports.

Current file: server/src/modules/leadProduct.service.ts
Issue: Line 2 has `import type { LeadProduct } from '../db/schema';`

Requirements:
1. Remove the direct schema import: `import type { LeadProduct } from '../db/schema';`
2. Replace with import from shared types: `import type { LeadProduct } from '@/types/database';`
3. Ensure all existing functionality remains unchanged
4. Verify that TypeScript compilation still works correctly
5. Do not modify any other imports or functionality

This is a simple import path change to follow the repository pattern for type imports.

Prerequisite: TICKET-006 must be completed first.
```

---

### TICKET-008: Fix Lead Service Type Imports
**Priority**: Low  
**Estimated Effort**: Small  
**Files**: `server/src/modules/lead.service.ts`

**AI Prompt:**
```
Update lead service to use shared database types instead of direct schema imports.

Current file: server/src/modules/lead.service.ts
Issue: Line 9 has `import { NewLead, NewLeadPointOfContact, Lead, LeadPointOfContact, LeadStatus } from '../db/schema';`

Requirements:
1. Remove the direct schema import from line 9
2. Replace with import from shared types: `import type { NewLead, NewLeadPointOfContact, Lead, LeadPointOfContact, LeadStatus } from '@/types/database';`
3. Ensure all existing functionality remains unchanged
4. Verify that TypeScript compilation still works correctly
5. Do not modify any other imports or functionality

This is a simple import path change to follow the repository pattern for type imports.

Prerequisite: TICKET-006 must be completed first.
```

---

### TICKET-009: Fix Lead Routes Type Imports
**Priority**: Low  
**Estimated Effort**: Small  
**Files**: `server/src/routes/lead.routes.ts`

**AI Prompt:**
```
Update lead routes to use shared database types instead of direct schema imports.

Current file: server/src/routes/lead.routes.ts
Issue: Line 22 has `import { NewLead } from '../db/schema';`

Requirements:
1. Remove the direct schema import: `import { NewLead } from '../db/schema';`
2. Replace with import from shared types: `import type { NewLead } from '@/types/database';`
3. Ensure all existing functionality remains unchanged
4. Verify that TypeScript compilation still works correctly
5. Do not modify any other imports or functionality

This is a simple import path change to follow the repository pattern for type imports.

Prerequisite: TICKET-006 must be completed first.
```

---

### TICKET-010: Fix Products Service Type Imports
**Priority**: Low  
**Estimated Effort**: Small  
**Files**: `server/src/modules/products.service.ts`

**AI Prompt:**
```
Update products service to use shared database types instead of direct schema imports.

Current file: server/src/modules/products.service.ts
Issue: Line 3 has `import type { Product, NewProduct } from '../db/schema';`

Requirements:
1. Remove the direct schema import: `import type { Product, NewProduct } from '../db/schema';`
2. Replace with import from shared types: `import type { Product, NewProduct } from '@/types/database';`
3. Ensure all existing functionality remains unchanged
4. Verify that TypeScript compilation still works correctly
5. Do not modify any other imports or functionality

This is a simple import path change to follow the repository pattern for type imports.

Prerequisite: TICKET-006 must be completed first.
```

---

### TICKET-011: Fix Contact Service Type Imports
**Priority**: Low  
**Estimated Effort**: Small  
**Files**: `server/src/modules/contact.service.ts`

**AI Prompt:**
```
Update contact service to use shared database types instead of direct schema imports.

Current file: server/src/modules/contact.service.ts
Issue: Line 1 has `import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';`

Requirements:
1. Remove the direct schema import: `import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';`
2. Replace with import from shared types: `import type { NewLeadPointOfContact, LeadPointOfContact } from '@/types/database';`
3. Ensure all existing functionality remains unchanged
4. Verify that TypeScript compilation still works correctly
5. Do not modify any other imports or functionality

This is a simple import path change to follow the repository pattern for type imports.

Prerequisite: TICKET-006 must be completed first.
```

---

### TICKET-012: Fix Contact Extraction Service Type Imports
**Priority**: Low  
**Estimated Effort**: Small  
**Files**: `server/src/modules/ai/contactExtraction.service.ts`

**AI Prompt:**
```
Update contact extraction service to use shared database types instead of direct schema imports.

Current file: server/src/modules/ai/contactExtraction.service.ts
Issue: Line 3 has `import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';`

Requirements:
1. Remove the direct schema import: `import { NewLeadPointOfContact, LeadPointOfContact } from '@/db/schema';`
2. Replace with import from shared types: `import type { NewLeadPointOfContact, LeadPointOfContact } from '@/types/database';`
3. Ensure all existing functionality remains unchanged
4. Verify that TypeScript compilation still works correctly
5. Do not modify any other imports or functionality

This is a simple import path change to follow the repository pattern for type imports.

Prerequisite: TICKET-006 must be completed first.
```

---

## Execution Order

### Phase 1: Critical Database Access Fixes
Execute tickets 001-005 in any order (they are independent)

### Phase 2: Type System Cleanup
1. Execute TICKET-006 first (creates shared types)
2. Execute TICKET-007 through TICKET-012 in any order

## Success Criteria
- All files pass the repository pattern validation
- No direct imports from `@/db` outside of repositories
- All existing functionality preserved
- TypeScript compilation successful
- All tests pass (if applicable)

## Notes for AI Agents
- Always test that existing functionality works after changes
- Preserve exact function signatures and behaviors
- If repository methods don't exist, create them first before refactoring the calling code
- Follow existing code style and patterns in the codebase