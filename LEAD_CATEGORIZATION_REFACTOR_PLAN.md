# Lead Categorization & Campaign Template System - Implementation Plan

## Overview

Transform DripIQ from a fully AI-generated campaign system to a structured template-driven approach where leads are categorized and follow predefined campaign flows, with AI focusing solely on content personalization.

## Product Requirements Summary

### Core Requirements

#### 1. Lead Category Assignment
- **Two initial categories**: `lost` and `cold`
- **Assignment**: Creator selects category during lead creation
- **Immutability**: Category cannot be changed after creation
- **UI**: Dropdown/radio selection in lead creation form

#### 2. Timezone Detection
- **Source**: AI determines timezone during lead research phase
- **Storage**: Timezone stored on lead record (IANA format)
- **Non-editable**: Users cannot modify timezone
- **Integration**: Used for campaign scheduling and quiet hours

#### 3. Campaign Template System
- **Structure**: Predefined 10-touchpoint campaigns per category
- **Flow Logic**: Each email (except final) has:
  - `no_open` transition (if not opened after X time)
  - `no_click` transition (if opened but not clicked after Y time)  
  - `default` next send (standard progression)
- **Final Email**: Only has stop transitions (no further sends)

#### 4. AI Content Generation
- **Scope**: AI generates only `subject` and `body` content
- **Context**: AI receives full campaign template context
- **Personalization**: AI uses lead research data for personalization
- **Structure**: Campaign flow/timing remains fixed per template

## Technical Architecture

### Database Schema Changes

#### New Tables

##### Lead Categories Table
```sql
CREATE TABLE app_schema.lead_categories (
  id TEXT PRIMARY KEY DEFAULT gen_cuid(),
  name TEXT NOT NULL UNIQUE, -- 'lost', 'cold'
  display_name TEXT NOT NULL, -- 'Lost Lead', 'Cold Lead'
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

##### Campaign Templates Table
```sql
CREATE TABLE app_schema.campaign_templates (
  id TEXT PRIMARY KEY DEFAULT gen_cuid(),
  name TEXT NOT NULL,
  lead_category_id TEXT REFERENCES app_schema.lead_categories(id),
  version TEXT DEFAULT '1.0',
  total_touchpoints INTEGER NOT NULL DEFAULT 10,
  template_json JSONB NOT NULL, -- Full campaign structure
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES app_schema.users(id),
  tenant_id TEXT REFERENCES app_schema.tenants(id), -- NULL for system templates
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(lead_category_id, tenant_id, version)
);
```

#### Table Updates

##### Leads Table
```sql
ALTER TABLE app_schema.leads 
ADD COLUMN category_id TEXT REFERENCES app_schema.lead_categories(id),
ADD COLUMN timezone TEXT; -- IANA timezone format
```

### Campaign Template Structure

```typescript
interface CampaignTemplateStructure {
  version: "1.0";
  timezone: "${LEAD_TIMEZONE}"; // Placeholder for lead's timezone
  quietHours: {
    start: "21:00";
    end: "07:30";
  };
  defaults: {
    timers: {
      no_open_after: "PT72H";
      no_click_after: "PT24H";
    };
  };
  startNodeId: "email_1";
  nodes: [
    // Email 1-9: Standard flow with progression
    {
      id: "email_1";
      channel: "email";
      action: "send";
      subject: "${AI_SUBJECT_1}"; // AI placeholder
      body: "${AI_BODY_1}"; // AI placeholder
      schedule: { delay: "PT0S" };
      transitions: [
        { on: "opened", to: "wait_click_1", within: "PT24H" },
        { on: "no_open", to: "email_2", after: "PT72H" },
        { on: "bounced", to: "stop", after: "PT0S" },
        { on: "unsubscribed", to: "stop", after: "PT0S" }
      ];
    },
    {
      id: "wait_click_1";
      channel: "email";
      action: "wait";
      transitions: [
        { on: "clicked", to: "stop", within: "PT24H" },
        { on: "no_click", to: "email_2", after: "PT24H" }
      ];
    },
    // ... emails 2-9 follow similar pattern
    
    // Email 10: Final email (no further progression)
    {
      id: "email_10";
      channel: "email";
      action: "send";
      subject: "${AI_SUBJECT_10}";
      body: "${AI_BODY_10}";
      schedule: { delay: "PT0S" };
      transitions: [
        { on: "opened", to: "stop", within: "PT72H" },
        { on: "no_open", to: "stop", after: "PT72H" },
        { on: "bounced", to: "stop", after: "PT0S" },
        { on: "unsubscribed", to: "stop", after: "PT0S" }
      ];
    },
    {
      id: "stop";
      channel: "email";
      action: "stop";
    }
  ];
}
```

## Implementation Phases

### Phase 1: Database & Core Structure
**Estimated Duration**: 2-3 days

#### Tasks:
1. **Database Schema Migration**
   - Create `lead_categories` table
   - Create `campaign_templates` table
   - Add `category_id` and `timezone` columns to `leads` table
   - Create database migration scripts

2. **Seed Data**
   - Insert initial categories: `lost` and `cold`
   - Create system campaign templates for each category
   - Define template timing patterns

3. **Repository Layer Updates**
   - Create `leadCategoryRepository`
   - Create `campaignTemplateRepository`
   - Update `leadRepository` for new fields

### Phase 2: Lead Creation Updates
**Estimated Duration**: 2-3 days

#### Tasks:
1. **API Updates**
   - Update lead creation endpoint to require category selection
   - Add category validation to lead creation
   - Update lead response DTOs to include category and timezone

2. **Frontend Updates**
   - Add category dropdown to lead creation form
   - Update lead creation validation on frontend
   - Update lead list/detail views to show category

3. **Service Layer Updates**
   - Update `lead.service.ts` for category handling
   - Add category validation logic

### Phase 3: AI Integration Updates
**Estimated Duration**: 3-4 days

#### Tasks:
1. **Timezone Detection**
   - Modify lead research AI to detect timezone from company data
   - Update lead analysis workflow to store timezone
   - Add timezone extraction to AI prompts

2. **Template-Based Campaign Generation**
   - Update AI service to use templates instead of full generation
   - Modify prompts to focus on content generation with template context
   - Create template variable replacement system

3. **Content Generation Service**
   - Create new service for AI content generation within templates
   - Update existing campaign generation to use templates
   - Maintain personalization quality with constrained structure

### Phase 4: Campaign Engine Updates
**Estimated Duration**: 3-4 days

#### Tasks:
1. **Template Resolution System**
   - Create service to resolve templates by lead category
   - Implement template variable replacement (timezone, AI content)
   - Update campaign execution to use resolved templates

2. **Campaign Persistence Updates**
   - Update campaign creation to use template structure
   - Modify campaign plan storage to reference templates
   - Ensure backward compatibility during transition

3. **Execution Engine Updates**
   - Update `CampaignPlanExecutionService` for template-based plans
   - Ensure proper template variable handling in execution
   - Update scheduling logic for template-based timing

### Phase 5: Testing & Validation
**Estimated Duration**: 2 days

#### Tasks:
1. **Integration Testing**
   - Test full lead creation to campaign execution flow
   - Validate category assignment and timezone detection
   - Test template resolution and content generation

2. **Performance Testing**
   - Ensure campaign execution maintains current performance
   - Test template system under load
   - Validate AI content generation speed

3. **Data Validation**
   - Verify all campaigns follow template structure
   - Test AI content quality with template constraints
   - Validate timezone handling across different regions

### Phase 6: Cleanup & Documentation
**Estimated Duration**: 1-2 days

#### Tasks:
1. **Code Cleanup**
   - Remove unused campaign generation logic
   - Clean up old schema and services
   - Update documentation and comments

2. **Migration Completion**
   - Finalize database cleanup
   - Update API documentation
   - Create admin documentation for template management

## Template Timing Patterns

### Lost Lead Template
**Aggressive follow-up pattern for re-engagement**
- **Email 1**: Immediate send
- **Email 2**: 3 days after Email 1 (if no open)
- **Email 3**: 5 days after Email 2 (if no open)
- **Email 4**: 7 days after Email 3 (if no open)
- **Email 5**: 7 days after Email 4 (if no open)
- **Email 6**: 14 days after Email 5 (if no open)
- **Email 7**: 14 days after Email 6 (if no open)
- **Email 8**: 21 days after Email 7 (if no open)
- **Email 9**: 21 days after Email 8 (if no open)
- **Email 10**: 30 days after Email 9 (if no open) - Final attempt

### Cold Lead Template  
**Gentle nurturing pattern for long-term relationship building**
- **Email 1**: Immediate send
- **Email 2**: 7 days after Email 1 (if no open)
- **Email 3**: 14 days after Email 2 (if no open)
- **Email 4**: 14 days after Email 3 (if no open)
- **Email 5**: 21 days after Email 4 (if no open)
- **Email 6**: 21 days after Email 5 (if no open)
- **Email 7**: 30 days after Email 6 (if no open)
- **Email 8**: 30 days after Email 7 (if no open)
- **Email 9**: 45 days after Email 8 (if no open)
- **Email 10**: 60 days after Email 9 (if no open) - Final attempt

## Migration Strategy

Since data can be destroyed (no current users):

### Clean Slate Approach
1. **Database Reset**: Drop and recreate relevant tables with new structure
2. **Seed System Data**: Insert categories and templates
3. **Service Updates**: Modify all services to use new structure
4. **Legacy Cleanup**: Remove old campaign generation code

### Migration Steps
1. Create new tables and seed data
2. Update all services to use template system
3. Update frontend to use category selection
4. Test complete flow end-to-end
5. Remove legacy code and old table structures

## Success Metrics

### Technical Metrics
- **Consistency**: 100% of campaigns follow predefined template structure
- **Performance**: Campaign execution speed maintains current benchmarks
- **Reliability**: Template resolution and AI content generation error rate < 1%

### Business Metrics
- **Personalization Quality**: AI content relevance scores maintain current levels
- **Campaign Effectiveness**: Open/click rates per template type
- **System Extensibility**: New categories/templates can be added in < 1 day

### Quality Assurance
- **Template Adherence**: All generated campaigns match template structure exactly
- **Content Quality**: AI-generated content maintains personalization standards
- **Timezone Accuracy**: Timezone detection accuracy > 95%

## Future Enhancements

### Tenant Template Management (Future Phase)
- UI for tenants to create custom categories
- Template builder interface
- Category and template versioning system
- Template performance analytics

### Advanced Features (Future Considerations)
- A/B testing for template variants
- Dynamic template selection based on lead scoring
- Integration with external data sources for enhanced categorization
- Advanced timezone detection using multiple data sources

---

## Development Tickets

This plan will be broken down into specific development tickets covering:
1. Database schema and migrations
2. Repository and service layer updates
3. AI integration modifications
4. Frontend component updates
5. Campaign engine modifications
6. Testing and validation
7. Documentation and cleanup

**Total Estimated Duration**: 12-16 days
**Recommended Team Size**: 2-3 developers
**Risk Level**: Medium (significant architectural changes)
**Business Impact**: High (foundational change for scalable campaign management)