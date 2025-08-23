# Implementation Tickets - Lead Categorization & Campaign Template System

## Epic Overview
Transform DripIQ from fully AI-generated campaigns to a structured template-driven approach with lead categorization and timezone support.

**Total Estimated Duration**: 12-16 days  
**Priority**: High  
**Risk Level**: Medium

---

## Phase 1: Database & Core Structure (2-3 days)

### Ticket 1.1: Database Schema Migration
**Story Points**: 5  
**Priority**: Critical  
**Dependencies**: None

#### Description
Create new database tables and update existing ones to support lead categorization and campaign templates.

#### Acceptance Criteria
- [ ] Create `lead_categories` table with proper indexes
- [ ] Create `campaign_templates` table with proper indexes  
- [ ] Add `category_id` and `timezone` columns to `leads` table
- [ ] Create Drizzle migration files
- [ ] Migration runs successfully without data loss
- [ ] All foreign key constraints work correctly

#### Technical Details
```sql
-- New tables to create
CREATE TABLE app_schema.lead_categories (
  id TEXT PRIMARY KEY DEFAULT gen_cuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE app_schema.campaign_templates (
  id TEXT PRIMARY KEY DEFAULT gen_cuid(),
  name TEXT NOT NULL,
  lead_category_id TEXT REFERENCES app_schema.lead_categories(id),
  version TEXT DEFAULT '1.0',
  total_touchpoints INTEGER NOT NULL DEFAULT 10,
  template_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES app_schema.users(id),
  tenant_id TEXT REFERENCES app_schema.tenants(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lead_category_id, tenant_id, version)
);

-- Table updates
ALTER TABLE app_schema.leads 
ADD COLUMN category_id TEXT REFERENCES app_schema.lead_categories(id),
ADD COLUMN timezone TEXT;
```

#### Files to Create/Update
- `server/src/db/migrations/XXXX_add_lead_categorization.sql`
- `server/src/db/schema.ts` (add new table definitions)

---

### Ticket 1.2: Seed Initial Data
**Story Points**: 3  
**Priority**: Critical  
**Dependencies**: Ticket 1.1

#### Description
Seed the database with initial lead categories and campaign templates for "lost" and "cold" leads.

#### Acceptance Criteria
- [ ] Seed script creates "lost" and "cold" categories
- [ ] Creates default campaign templates for each category
- [ ] Templates follow 10-touchpoint structure with proper timing
- [ ] Templates include AI placeholder variables
- [ ] Seed script is idempotent (can run multiple times safely)

#### Technical Details
- Create seed data for 2 categories: `lost` and `cold`
- Create 2 campaign templates with 10-email sequences
- Templates should include proper ISO duration timing
- Use placeholder variables for AI content: `${AI_SUBJECT_1}`, `${AI_BODY_1}`, etc.

#### Files to Create/Update
- `server/src/db/seed-categories.ts`
- `server/src/db/seed-templates.ts`
- Update `server/src/db/seed.ts` to include new seeders

---

### Ticket 1.3: Repository Layer Updates
**Story Points**: 5  
**Priority**: High  
**Dependencies**: Ticket 1.1

#### Description
Create repository classes for the new tables and update existing repositories to handle new fields.

#### Acceptance Criteria
- [ ] Create `LeadCategoryRepository` with CRUD operations
- [ ] Create `CampaignTemplateRepository` with CRUD operations
- [ ] Update `LeadRepository` to handle category and timezone
- [ ] All repositories include proper error handling
- [ ] Repositories include TypeScript types for all operations
- [ ] Unit tests for repository operations

#### Files to Create/Update
- `server/src/repositories/leadCategory.repository.ts`
- `server/src/repositories/campaignTemplate.repository.ts`
- Update `server/src/repositories/lead.repository.ts`
- Update `server/src/repositories/index.ts`
- Add test files for new repositories

---

## Phase 2: Lead Creation Updates (2-3 days)

### Ticket 2.1: Backend API Updates
**Story Points**: 5  
**Priority**: High  
**Dependencies**: Ticket 1.3

#### Description
Update lead creation and management APIs to support category selection and timezone storage.

#### Acceptance Criteria
- [ ] Lead creation endpoint requires category selection
- [ ] Lead creation validates category exists and is active
- [ ] Lead response DTOs include category and timezone information
- [ ] Lead list endpoint supports filtering by category
- [ ] API documentation updated for new fields
- [ ] Proper error messages for invalid categories

#### Technical Details
- Update `POST /leads` endpoint to require `categoryId`
- Update lead validation schemas
- Add category information to lead response objects
- Support category filtering in lead listing

#### Files to Create/Update
- `server/src/routes/leads.ts`
- `server/src/modules/lead.service.ts`
- Update lead validation schemas
- Update API documentation

---

### Ticket 2.2: Frontend Lead Creation Updates
**Story Points**: 8  
**Priority**: High  
**Dependencies**: Ticket 2.1

#### Description
Update frontend lead creation form to include category selection and display category information throughout the UI.

#### Acceptance Criteria
- [ ] Lead creation form includes category dropdown
- [ ] Category dropdown populated from backend API
- [ ] Category selection is required and validated
- [ ] Lead list shows category information
- [ ] Lead detail view displays category and timezone
- [ ] Category can be used for filtering leads
- [ ] Proper loading and error states

#### Files to Create/Update
- Update lead creation form component
- Update lead list component to show categories
- Update lead detail view
- Add category filter component
- Update lead-related TypeScript types

---

## Phase 3: AI Integration Updates (3-4 days)

### Ticket 3.1: Timezone Detection Service
**Story Points**: 8  
**Priority**: High  
**Dependencies**: Ticket 1.3

#### Description
Modify the lead research AI to detect and store timezone information based on company location data.

#### Acceptance Criteria
- [ ] AI extracts timezone from company location/address
- [ ] Timezone stored in IANA format (e.g., "America/New_York")
- [ ] Fallback timezone logic for unclear locations
- [ ] Timezone detection integrated into lead analysis workflow
- [ ] Timezone accuracy validation and logging
- [ ] Handle edge cases (multiple locations, unclear data)

#### Technical Details
- Update AI prompts to extract location information
- Add timezone detection logic using location data
- Implement fallback strategies for ambiguous cases
- Store timezone during lead analysis phase

#### Files to Create/Update
- `server/src/modules/ai/timezoneDetection.service.ts`
- Update `server/src/modules/ai/leadAnalyzer.service.ts`
- Update AI prompts to include location extraction
- Add timezone detection to lead analysis workflow

---

### Ticket 3.2: Template-Based Content Generation
**Story Points**: 13  
**Priority**: Critical  
**Dependencies**: Ticket 3.1, Ticket 1.2

#### Description
Replace the current full campaign generation with template-based content generation where AI only creates subject lines and email bodies.

#### Acceptance Criteria
- [ ] AI generates content for template placeholders only
- [ ] Content generation receives full template context
- [ ] Generated content maintains personalization quality
- [ ] Template variable replacement system works correctly
- [ ] Content generation integrated with campaign creation workflow
- [ ] Proper error handling for content generation failures
- [ ] Generated content respects template structure and timing

#### Technical Details
- Create new content generation service
- Update AI prompts to focus on content within template context
- Implement template variable replacement
- Maintain existing personalization quality

#### Files to Create/Update
- `server/src/modules/ai/templateContentGeneration.service.ts`
- Update `server/src/modules/ai/contactStrategy.service.ts`
- Create new AI prompts for template-based generation
- Update campaign generation workflow

---

### Ticket 3.3: Template Resolution Service
**Story Points**: 5  
**Priority**: High  
**Dependencies**: Ticket 3.2

#### Description
Create service to resolve campaign templates based on lead category and replace template variables with actual content.

#### Acceptance Criteria
- [ ] Service retrieves template by lead category
- [ ] Template variables replaced with lead timezone
- [ ] AI-generated content properly inserted into templates
- [ ] Template resolution handles missing templates gracefully
- [ ] Resolved templates validate against campaign schema
- [ ] Caching implemented for template performance

#### Files to Create/Update
- `server/src/modules/campaign/templateResolution.service.ts`
- Update campaign creation workflow to use templates
- Add template caching logic

---

## Phase 4: Campaign Engine Updates (3-4 days)

### Ticket 4.1: Campaign Creation Service Updates
**Story Points**: 8  
**Priority**: High  
**Dependencies**: Ticket 3.3

#### Description
Update campaign creation and persistence to use resolved templates instead of fully AI-generated plans.

#### Acceptance Criteria
- [ ] Campaign creation uses template resolution service
- [ ] Campaign persistence works with template-based plans
- [ ] Template reference stored alongside campaign data
- [ ] Campaign creation maintains existing API compatibility
- [ ] Template-based campaigns execute correctly
- [ ] Proper error handling for template resolution failures

#### Files to Create/Update
- Update `server/src/modules/campaign/contactCampaignPlan.service.ts`
- Update campaign creation workflow
- Modify campaign persistence logic

---

### Ticket 4.2: Campaign Execution Engine Updates
**Story Points**: 8  
**Priority**: High  
**Dependencies**: Ticket 4.1

#### Description
Update the campaign execution engine to properly handle template-based campaign plans.

#### Acceptance Criteria
- [ ] Campaign execution works with template-based plans
- [ ] Template timing logic executes correctly
- [ ] Campaign transitions follow template structure
- [ ] Scheduling respects lead timezone from template
- [ ] Execution maintains current performance levels
- [ ] Proper logging for template-based execution

#### Files to Create/Update
- Update `server/src/modules/campaign/campaignPlanExecution.service.ts`
- Update campaign scheduling logic
- Ensure timezone handling in execution

---

## Phase 5: Testing & Validation (2 days)

### Ticket 5.1: Integration Testing
**Story Points**: 8  
**Priority**: High  
**Dependencies**: All Phase 4 tickets

#### Description
Comprehensive testing of the complete lead creation to campaign execution flow with the new template system.

#### Acceptance Criteria
- [ ] End-to-end test: lead creation → analysis → campaign generation → execution
- [ ] Category assignment works correctly
- [ ] Timezone detection accuracy validated
- [ ] Template resolution tested for both categories
- [ ] AI content generation quality maintained
- [ ] Campaign execution follows template timing
- [ ] Error scenarios handled gracefully

#### Files to Create/Update
- `server/src/__tests__/integration/leadCategorization.test.ts`
- `server/src/__tests__/integration/templateCampaigns.test.ts`
- Update existing integration tests

---

### Ticket 5.2: Performance & Load Testing
**Story Points**: 5  
**Priority**: Medium  
**Dependencies**: Ticket 5.1

#### Description
Validate that the template system maintains current performance levels and handles expected load.

#### Acceptance Criteria
- [ ] Template resolution performance benchmarked
- [ ] Campaign execution speed maintains current levels
- [ ] Database queries optimized for new schema
- [ ] Memory usage within acceptable limits
- [ ] Load testing passes for expected concurrent campaigns
- [ ] Performance regression testing completed

---

## Phase 6: Cleanup & Documentation (1-2 days)

### Ticket 6.1: Legacy Code Cleanup
**Story Points**: 5  
**Priority**: Medium  
**Dependencies**: Ticket 5.2

#### Description
Remove unused campaign generation code and clean up deprecated functionality.

#### Acceptance Criteria
- [ ] Unused AI campaign generation code removed
- [ ] Deprecated schemas and types cleaned up
- [ ] Database cleanup for unused tables/columns
- [ ] Import statements updated
- [ ] Code comments and documentation updated
- [ ] No dead code remains

#### Files to Update
- Remove unused AI generation services
- Clean up old campaign schemas
- Update imports and dependencies
- Remove deprecated API endpoints

---

### Ticket 6.2: Documentation & Admin Setup
**Story Points**: 3  
**Priority**: Low  
**Dependencies**: Ticket 6.1

#### Description
Update documentation and create admin interfaces for template management.

#### Acceptance Criteria
- [ ] API documentation updated for new endpoints
- [ ] Database schema documentation updated
- [ ] Admin documentation for template management created
- [ ] Deployment guide updated for new migrations
- [ ] Code comments and inline documentation updated

#### Files to Create/Update
- Update API documentation
- Create admin documentation
- Update README with new features
- Update deployment guides

---

## Risk Mitigation

### High Risk Items
1. **AI Content Quality**: Template constraints might affect personalization
   - **Mitigation**: Extensive testing and prompt optimization

2. **Database Migration**: Schema changes on existing data
   - **Mitigation**: Thorough testing and rollback procedures

3. **Campaign Execution Changes**: Core business logic modifications
   - **Mitigation**: Feature flags and gradual rollout

### Dependencies
- All Phase 2 depends on Phase 1 completion
- Phase 3 can start after Phase 1 completion
- Phase 4 requires Phase 3 completion
- Phases 5-6 are sequential

### Success Criteria
- All campaigns follow template structure (100%)
- AI content quality maintained (>95% satisfaction)
- Performance maintained or improved
- Zero data loss during migration
- All tests pass with >95% coverage