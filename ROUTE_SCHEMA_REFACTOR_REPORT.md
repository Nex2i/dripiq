# Route Schema Refactoring Report

## Executive Summary

This report analyzes the current server route structure and provides a comprehensive plan to refactor request and response schemas into separate, organized files under a new `apiSchema` directory structure.

## Current State Analysis

### Route Files Overview
The server currently has **10 route files** containing a total of **48 routes** and **22 schema definitions**:

1. **authentication.routes.ts** - 6 routes, 2 schemas
2. **contact.routes.ts** - 5 routes, 3 schemas  
3. **firecrawl.webhook.routes.ts** - 2 routes, 1 schema
4. **invite.routes.ts** - 5 routes, 3 schemas
5. **lead.routes.ts** - 13 routes, 5 schemas
6. **logo.routes.ts** - 1 route, 2 schemas
7. **organization.routes.ts** - 3 routes, 0 schemas (uses TypeScript interfaces)
8. **ping.routes.ts** - 1 route, 0 schemas
9. **products.routes.ts** - 5 routes, 0 schemas (uses TypeScript interfaces)
10. **roles.routes.ts** - 10 routes, 3 schemas

### Current Schema Patterns

#### TypeBox Schemas (Preferred Pattern)
Most routes use `@sinclair/typebox` for schema validation:
```typescript
const createLeadBodySchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Lead name' }),
  url: Type.String({ format: 'uri', minLength: 1, description: 'Lead website URL' })
});
```

#### TypeScript Interfaces (Legacy Pattern)
Some routes use plain TypeScript interfaces without runtime validation:
```typescript
interface CreateProductBody {
  title: string;
  description?: string;
}
```

### Schema Distribution by Route File

#### High Complexity (5+ schemas)
- **lead.routes.ts**: 5 schemas
  - `pointOfContactSchema`
  - `pointOfContactResponseSchema` 
  - `leadStatusResponseSchema`
  - `createLeadBodySchema`
  - `leadResponseSchema`

#### Medium Complexity (3 schemas)
- **contact.routes.ts**: 3 schemas
  - `pointOfContactSchema` (duplicate)
  - `pointOfContactUpdateSchema`
  - `pointOfContactResponseSchema` (duplicate)
- **invite.routes.ts**: 3 schemas
  - `createInviteSchema`
  - `usersQuerySchema`
  - `updateUserRoleSchema`
- **roles.routes.ts**: 3 schemas
  - `createRoleBodySchema`
  - `createPermissionBodySchema`
  - `assignPermissionBodySchema`

#### Low Complexity (1-2 schemas)
- **authentication.routes.ts**: 2 schemas
- **firecrawl.webhook.routes.ts**: 1 schema
- **logo.routes.ts**: 2 schemas

## Proposed Directory Structure

```
server/src/routes/
├── apiSchema/
│   ├── authentication/
│   │   ├── register.schema.ts
│   │   └── createUser.schema.ts
│   ├── contact/
│   │   ├── contact.create.schema.ts
│   │   ├── contact.update.schema.ts
│   │   ├── contact.get.schema.ts
│   │   └── contact.delete.schema.ts
│   ├── firecrawl/
│   │   └── webhook.response.schema.ts
│   ├── invite/
│   │   ├── invite.create.schema.ts
│   │   ├── users.query.schema.ts
│   │   └── user.updateRole.schema.ts
│   ├── lead/
│   │   ├── lead.create.schema.ts
│   │   ├── lead.get.schema.ts
│   │   ├── lead.update.schema.ts
│   │   ├── lead.delete.schema.ts
│   │   ├── lead.analyze.schema.ts
│   │   ├── lead.generateStrategy.schema.ts
│   │   ├── lead.assignOwner.schema.ts
│   │   ├── leadProduct.attach.schema.ts
│   │   └── leadProduct.detach.schema.ts
│   ├── logo/
│   │   └── logo.upload.schema.ts
│   ├── organization/
│   │   ├── organization.get.schema.ts
│   │   ├── organization.update.schema.ts
│   │   └── organization.analyze.schema.ts
│   ├── product/
│   │   ├── product.create.schema.ts
│   │   ├── product.get.schema.ts
│   │   ├── product.update.schema.ts
│   │   └── product.delete.schema.ts
│   ├── role/
│   │   ├── role.create.schema.ts
│   │   ├── role.get.schema.ts
│   │   ├── permission.create.schema.ts
│   │   └── permission.assign.schema.ts
│   └── shared/
│       ├── pointOfContact.schema.ts
│       ├── pagination.schema.ts
│       └── common.schema.ts
└── [existing route files...]
```

## Schema File Naming Convention

Each schema file should follow the pattern: `{resource}.{action}.schema.ts`

Examples:
- `lead.create.schema.ts` - For lead creation request/response
- `contact.update.schema.ts` - For contact update request/response  
- `user.query.schema.ts` - For user listing query parameters
- `product.delete.schema.ts` - For product deletion parameters/response

## Refactoring Tickets

### Phase 1: Foundation Setup

#### Ticket 1: Create Base Schema Directory Structure
**Priority**: High  
**Effort**: 1 day  
**Description**: Create the `apiSchema` directory structure and establish naming conventions.

**Tasks**:
- Create `server/src/routes/apiSchema/` directory
- Create subdirectories for each resource: `authentication/`, `contact/`, `firecrawl/`, `invite/`, `lead/`, `logo/`, `organization/`, `product/`, `role/`, `shared/`
- Create documentation for schema naming conventions
- Setup index files for easy imports

**Acceptance Criteria**:
- Directory structure matches proposed layout
- Each subdirectory has an `index.ts` file for exports
- Documentation explains naming conventions

#### Ticket 2: Create Shared Schema Library
**Priority**: High  
**Effort**: 2 days  
**Description**: Extract common schemas into shared library to eliminate duplication.

**Tasks**:
- Create `shared/pointOfContact.schema.ts` (used in lead and contact routes)
- Create `shared/pagination.schema.ts` for query parameters
- Create `shared/common.schema.ts` for base response types
- Update `types/response.ts` to use new schema structure

**Acceptance Criteria**:
- No duplicate schema definitions
- Shared schemas are properly typed
- Backward compatibility maintained

### Phase 2: High-Priority Route Refactoring

#### Ticket 3: Refactor Lead Route Schemas
**Priority**: High  
**Effort**: 3 days  
**Description**: Extract all 5 schemas from `lead.routes.ts` and organize by endpoint.

**Schemas to Extract**:
- `lead.create.schema.ts` (`createLeadBodySchema`)
- `lead.get.schema.ts` (`leadResponseSchema`) 
- `lead.status.schema.ts` (`leadStatusResponseSchema`)
- `leadProduct.attach.schema.ts` (new for product attachment)
- `leadProduct.detach.schema.ts` (new for product detachment)

**Tasks**:
- Create request/response schemas for each of 13 lead endpoints
- Import shared `pointOfContact.schema.ts`
- Update lead routes to use new schema imports
- Ensure all inline schemas are extracted

**Acceptance Criteria**:
- All lead route schemas moved to separate files
- Route file only contains route definitions
- No schema definitions in route file
- All tests pass

#### Ticket 4: Refactor Contact Route Schemas  
**Priority**: High  
**Effort**: 2 days  
**Description**: Extract 3 schemas from `contact.routes.ts`.

**Schemas to Extract**:
- `contact.create.schema.ts` (using shared pointOfContact)
- `contact.update.schema.ts` (`pointOfContactUpdateSchema`)
- `contact.get.schema.ts` (response schema)

**Tasks**:
- Create schema files for 5 contact endpoints
- Remove duplicate `pointOfContactSchema` (use shared version)
- Update contact routes to use new imports

**Acceptance Criteria**:
- No duplicate schemas
- All contact endpoints have dedicated schema files
- Route file only contains route definitions

#### Ticket 5: Refactor Roles Route Schemas
**Priority**: Medium  
**Effort**: 2 days  
**Description**: Extract 3 schemas from `roles.routes.ts` covering 10 endpoints.

**Schemas to Extract**:
- `role.create.schema.ts` (`createRoleBodySchema`)
- `permission.create.schema.ts` (`createPermissionBodySchema`)
- `permission.assign.schema.ts` (`assignPermissionBodySchema`)
- Additional schemas for remaining endpoints

**Tasks**:
- Create schema files for all 10 role/permission endpoints
- Organize by resource (role vs permission)
- Update route imports

**Acceptance Criteria**:
- All role and permission operations have dedicated schemas
- Clear separation between role and permission schemas

### Phase 3: Medium-Priority Route Refactoring

#### Ticket 6: Refactor Authentication Route Schemas
**Priority**: Medium  
**Effort**: 1.5 days  
**Description**: Extract 2 schemas from `authentication.routes.ts`.

**Schemas to Extract**:
- `register.schema.ts` (`registerBodySchema`)
- `createUser.schema.ts` (`createUserBodySchema`)

**Tasks**:
- Create schema files for 6 authentication endpoints
- Handle response schemas for token/session management

#### Ticket 7: Refactor Invite Route Schemas
**Priority**: Medium  
**Effort**: 1.5 days  
**Description**: Extract 3 schemas from `invite.routes.ts`.

**Schemas to Extract**:
- `invite.create.schema.ts` (`createInviteSchema`)
- `users.query.schema.ts` (`usersQuerySchema`)
- `user.updateRole.schema.ts` (`updateUserRoleSchema`)

#### Ticket 8: Convert Organization Routes to TypeBox Schemas
**Priority**: Medium  
**Effort**: 2 days  
**Description**: Convert TypeScript interfaces to TypeBox schemas for runtime validation.

**Current Interfaces to Convert**:
- `OrganizationParams` → `organization.params.schema.ts`
- `UpdateOrganizationBody` → `organization.update.schema.ts`

**Tasks**:
- Convert all interfaces to TypeBox schemas
- Add runtime validation to all endpoints
- Create response schemas

#### Ticket 9: Convert Product Routes to TypeBox Schemas
**Priority**: Medium  
**Effort**: 2 days  
**Description**: Convert TypeScript interfaces to TypeBox schemas for runtime validation.

**Current Interfaces to Convert**:
- `CreateProductBody` → `product.create.schema.ts`
- `UpdateProductBody` → `product.update.schema.ts`
- `ProductParams` → `product.params.schema.ts`
- `ProductQuery` → `product.query.schema.ts`

### Phase 4: Low-Priority Route Refactoring

#### Ticket 10: Refactor Remaining Small Routes
**Priority**: Low  
**Effort**: 1 day  
**Description**: Handle remaining routes with minimal schemas.

**Routes to Refactor**:
- `logo.routes.ts` (2 schemas)
- `firecrawl.webhook.routes.ts` (1 schema)
- `ping.routes.ts` (no schemas, add health check response)

### Phase 5: Clean-up and Optimization

#### Ticket 11: Update Import Statements and Remove Dead Code
**Priority**: Medium  
**Effort**: 1 day  
**Description**: Clean up all route files after schema extraction.

**Tasks**:
- Update all import statements to use new schema locations
- Remove old schema definitions
- Clean up unused imports
- Update TypeScript paths in `tsconfig.json` if needed

#### Ticket 12: Add Schema Documentation and Examples
**Priority**: Low  
**Effort**: 1 day  
**Description**: Document the new schema structure and provide examples.

**Tasks**:
- Create README for apiSchema directory
- Add JSDoc comments to all schemas
- Provide usage examples
- Document shared schema patterns

#### Ticket 13: Create Schema Validation Tests
**Priority**: Medium  
**Effort**: 2 days  
**Description**: Ensure all schemas have proper test coverage.

**Tasks**:
- Create unit tests for each schema file
- Test request validation
- Test response serialization
- Validate shared schema reusability

## Implementation Guidelines

### Schema File Template
```typescript
import { Type } from '@sinclair/typebox';

// Request schema
export const CreateLeadRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, description: 'Lead name' }),
  url: Type.String({ format: 'uri', description: 'Lead website URL' })
});

// Response schema  
export const CreateLeadResponseSchema = Type.Object({
  id: Type.String({ description: 'Lead ID' }),
  name: Type.String({ description: 'Lead name' }),
  url: Type.String({ description: 'Lead URL' }),
  createdAt: Type.String({ format: 'date-time' })
});

// Param schema (if needed)
export const LeadParamsSchema = Type.Object({
  leadId: Type.String({ description: 'Lead ID' })
});

// Export for easy importing
export const LeadCreateSchema = {
  body: CreateLeadRequestSchema,
  response: {
    201: CreateLeadResponseSchema
  },
  params: LeadParamsSchema
} as const;
```

### Import Pattern in Route Files
```typescript
import { LeadCreateSchema } from '../apiSchema/lead/lead.create.schema';

fastify.route({
  method: 'POST',
  url: '/leads',
  schema: LeadCreateSchema,
  handler: createLeadHandler
});
```

## Benefits of This Refactoring

1. **Separation of Concerns**: Route logic separated from schema definitions
2. **Reusability**: Shared schemas eliminate duplication
3. **Maintainability**: Easier to update schemas without touching route logic
4. **Discoverability**: Clear naming convention makes schemas easy to find
5. **Type Safety**: Consistent TypeBox usage ensures runtime validation
6. **Documentation**: Schema files serve as API documentation
7. **Testing**: Schemas can be unit tested independently

## Risk Assessment

**Low Risk**:
- Incremental refactoring approach
- Backward compatibility maintained
- Existing tests continue to work

**Mitigation Strategies**:
- Implement in phases to minimize disruption
- Maintain existing route behavior
- Add comprehensive testing for new schema structure
- Use feature flags for gradual rollout if needed

## Estimated Timeline

- **Phase 1 (Foundation)**: 3 days
- **Phase 2 (High Priority)**: 8 days  
- **Phase 3 (Medium Priority)**: 9 days
- **Phase 4 (Low Priority)**: 1 day
- **Phase 5 (Clean-up)**: 4 days

**Total Estimated Effort**: 25 days (5 weeks)

## Success Criteria

1. All route files contain only route definitions (no schema definitions)
2. All schemas organized in `apiSchema` directory with consistent naming
3. No duplicate schema definitions
4. All TypeScript interfaces converted to TypeBox schemas
5. Comprehensive test coverage for all schemas
6. Documentation for new schema structure
7. All existing functionality preserved
8. Improved developer experience for API maintenance

---

*Report generated on: $(date)*
*Next Review Date: After Phase 1 completion*