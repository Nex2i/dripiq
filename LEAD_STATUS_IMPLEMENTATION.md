# Lead Status System Implementation

## Overview
This implementation adds a comprehensive status tracking system for leads, allowing multiple statuses to track the progress of lead processing through different stages.

## Database Changes

### New Table: `lead_statuses`
- **Purpose**: Track multiple statuses for each lead
- **Fields**:
  - `id`: Primary key
  - `lead_id`: Foreign key to leads table
  - `status`: Enum ('New', 'Scraping Site', 'Analyzing Site', 'Extracting Contacts', 'Processed')
  - `tenant_id`: Foreign key to tenants table (for tenant isolation)
  - `created_at`, `updated_at`: Timestamps
- **Constraints**: Unique constraint on `(lead_id, status)` to prevent duplicates

### Migration
- **File**: `0021_add_lead_statuses.sql`
- **Features**:
  - Creates the new table with proper foreign keys
  - Data migration to populate existing leads with appropriate statuses:
    - Leads with summaries get "Processed" status
    - Other leads get "New" status

## Backend Changes

### Lead Service (`lead.service.ts`)
**New Functions**:
- `getLeadStatuses(tenantId, leadId)`: Get all statuses for a lead
- `hasStatus(tenantId, leadId, status)`: Check if lead has specific status
- `ensureDefaultStatus(tenantId, leadId)`: Ensure lead has at least "New" status
- `updateLeadStatuses(tenantId, leadId, statusesToAdd, statusesToRemove)`: Central status management

**Updated Functions**:
- `getLeadById()`: Now returns statuses array
- `createLead()`: Automatically creates "New" status for new leads

### Processing Services Integration

#### LeadAnalyzerService (`leadAnalyzer.service.ts`)
- `indexSite()`: Adds "Scraping Site" status when scraping starts
- `analyze()`: Manages status transitions:
  - Removes "New", adds "Analyzing Site"
  - Removes "Analyzing Site" and "Extracting Contacts", adds "Processed" when complete
- `extractContacts()`: Adds "Extracting Contacts" status

#### SiteAnalyzerService (`siteAnalyzer.service.ts`)
- `completeFirecrawlCrawl()`: Removes "Scraping Site" status when scraping completes

### API Updates
- **Lead Response Schema**: Now includes `statuses` array
- **Status Schema**: Defines the structure for lead status responses

## Frontend Changes

### New Component: `LeadStatusBadges.tsx`
- **Purpose**: Display status badges with appropriate colors and icons
- **Features**:
  - Color-coded badges for each status type
  - Icons for visual distinction
  - Sorted by creation date to show progression

### Updated Pages

#### LeadDetailPage (`LeadDetailPage.tsx`)
- Added status badges display in the header section
- Updated LeadDetailsTab integration

#### LeadsPage (`LeadsPage.tsx`)
- Updated table to show status badges instead of single status
- Uses new `statuses` accessor instead of `status`

#### LeadDetailsTab (`LeadDetailsTab.tsx`)
- Updated to use LeadStatusBadges component
- Changed from single status to multiple statuses display

### Type Updates (`leads.service.ts`)
- Added `LeadStatus` interface
- Updated `Lead` interface to include `statuses` array

## Status Flow

### Typical Lead Processing Flow:
1. **New**: Default status for newly created leads
2. **Scraping Site**: Added when `indexSite()` is called
3. **Analyzing Site**: Added when scraping completes and analysis begins
4. **Extracting Contacts**: Added during contact extraction phase
5. **Processed**: Final status when all processing is complete

### Business Rules:
- Leads must have at least one status (defaults to "New")
- Multiple statuses can exist simultaneously during processing
- Statuses are automatically managed by the processing services
- Statuses are read-only in the UI (not user-editable)

## Migration Notes

To apply these changes:

1. **Run Database Migration**:
   ```bash
   npm run db:migrate
   ```

2. **Restart Server**: To load new schema and functions

3. **Frontend**: Changes are automatically available

## Status Icons and Colors

- **New**: ✨ Blue
- **Scraping Site**: 🔍 Yellow  
- **Analyzing Site**: 🧠 Orange
- **Extracting Contacts**: 📞 Purple
- **Processed**: ✅ Green

This implementation provides comprehensive tracking of lead processing status while maintaining backward compatibility with the existing status field.