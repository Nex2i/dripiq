# Closed-Lost Lead Revival Feature - Complete Ticket Breakdown

## Epic: Closed-Lost Lead Bulk Upload System

---

## Frontend Tickets

### Ticket 1: File Upload Interface & Validation
**Priority:** High | **Story Points:** 5 | **Type:** Feature

#### Description
Create a dedicated upload page that allows users to select CSV/Excel files, validates file constraints, and prepares data for preview using PapaParse and Web Workers for performance.

#### Acceptance Criteria
- [ ] Dedicated upload page accessible via main navigation
- [ ] File input accepts only .csv, .xls, .xlsx files
- [ ] File size validation (10MB maximum)
- [ ] Row count validation (10k rows maximum)
- [ ] PapaParse integration for CSV parsing
- [ ] Web Worker implementation for background processing
- [ ] Error handling for corrupted/invalid files
- [ ] Loading states during file processing
- [ ] User-friendly error messages for all validation failures

#### Technical Requirements
- Use PapaParse library for CSV parsing
- Implement Web Worker for file processing to keep UI responsive
- File size check before processing
- Support for Excel files (.xls, .xlsx) using appropriate library

#### AI Prompt for Implementation
```
I need to create a file upload interface for a lead management system. Here are the requirements:

1. Create a dedicated upload page component with file input
2. Restrict file types to .csv, .xls, .xlsx only
3. Validate file size (10MB max) and estimated row count (10k max)
4. Integrate PapaParse for CSV parsing
5. Use Web Workers for background file processing
6. Handle Excel files (.xls, .xlsx) - suggest appropriate library
7. Implement comprehensive error handling with user-friendly messages
8. Add loading states during file processing
9. Parse first 10 rows for preview (excluding header if detected)

The page should be clean, modern UI with drag-drop functionality. Include progress indicators and clear validation feedback. Use TypeScript and modern React patterns.

Please provide the complete implementation including:
- Main upload page component
- File validation logic
- Web Worker setup for parsing
- Error handling components
- TypeScript interfaces for file data
```

---

### Ticket 2: Preview Table & Column Mapping
**Priority:** High | **Story Points:** 8 | **Type:** Feature

#### Description
Build an interactive preview table showing the first 10 rows of uploaded data with dropdown mapping for each CSV column to lead schema fields. Include real-time validation and whitespace trimming preview.

#### Acceptance Criteria
- [ ] Preview table displays first 10 rows (excluding header if detected)
- [ ] Column mapping dropdowns for each CSV column
- [ ] All required lead schema fields must be mapped: `name`, `url`, `summary`, `products`, `services`, `differentiators`, `targetMarket`, `tone`, `brandColors`, `closedLostReason`
- [ ] Header detection checkbox functionality
- [ ] Real-time validation that all required fields are mapped
- [ ] Preview shows data with whitespace trimmed
- [ ] Visual indicators for unmapped required fields
- [ ] Ability to reset/clear mappings
- [ ] Responsive table design for large datasets

#### Technical Requirements
- Dynamic table component with mapping controls
- Real-time validation feedback
- Data transformation preview
- Lead schema field definitions
- Responsive design for various screen sizes

#### AI Prompt for Implementation
```
I need to create a column mapping interface for CSV lead imports. Here are the requirements:

1. Build a preview table component showing first 10 rows of CSV data
2. Add dropdown selectors for each CSV column to map to lead schema fields
3. Required lead schema fields to map: name, url, summary, products, services, differentiators, targetMarket, tone, brandColors, closedLostReason
4. Include header detection checkbox that updates preview when toggled
5. Implement real-time validation ensuring all required fields are mapped
6. Show preview data with whitespace trimming applied
7. Visual indicators (red borders, error messages) for unmapped required fields
8. Reset/clear mappings functionality
9. Handle JSONB fields (products, services, differentiators, brandColors) - show how comma-separated values will be parsed

The interface should be intuitive with clear visual feedback. Use a modern table design with good UX for mapping controls. Include TypeScript types for the mapping configuration.

Please provide:
- Preview table component with mapping dropdowns
- Validation logic for required field mapping
- Data transformation preview functionality
- Clear error states and messaging
- TypeScript interfaces for mapping config
```

---

### Ticket 3: Closed-Lost Reason Configuration
**Priority:** Medium | **Story Points:** 3 | **Type:** Feature

#### Description
Add configuration options for closed-lost reason handling with two modes: apply to all leads or only to leads with missing/invalid reasons. Include live validation and preview integration.

#### Acceptance Criteria
- [ ] Radio button selection for global reason behavior:
  - "Apply to all leads"
  - "Apply only to leads with missing/invalid reasons"
- [ ] Global reason input field with validation
- [ ] Live validation ensuring all leads will have a reason after processing
- [ ] Integration with preview table to show applied reasons
- [ ] Clear labeling and help text for each option
- [ ] Required field validation for global reason input
- [ ] Preview updates when configuration changes

#### Technical Requirements
- Form validation for required global reason
- Integration with preview table updates
- Clear UX for the two different modes
- Real-time feedback on how configuration affects data

#### AI Prompt for Implementation
```
I need to create a closed-lost reason configuration component with these requirements:

1. Two radio button options:
   - "Apply global reason to ALL leads"
   - "Apply global reason only to leads with MISSING/INVALID reasons"
2. Text input field for the global closed-lost reason
3. Live validation that ensures all leads will have a reason after processing
4. Integration with the preview table to show how the reason will be applied
5. Help text explaining each option clearly
6. Required field validation with clear error messages
7. Real-time preview updates when configuration changes

The component should clearly communicate the difference between the two modes and show users exactly how their data will be affected. Include validation that prevents proceeding without a valid configuration.

Please provide:
- Configuration form component with radio buttons and input
- Validation logic ensuring all leads get a reason
- Preview integration showing applied reasons
- Clear help text and error messaging
- TypeScript interfaces for configuration
```

---

### Ticket 4: Chunked Upload & Progress
**Priority:** High | **Story Points:** 6 | **Type:** Feature

#### Description
Implement chunked upload functionality that converts mapped data to JSON and uploads in batches with progress tracking, cancellation support, and retry logic for failed chunks.

#### Acceptance Criteria
- [ ] Convert mapped CSV data to JSON format
- [ ] Chunk data into batches of 500-1000 rows
- [ ] Progress bar showing upload percentage
- [ ] Upload cancellation using AbortController
- [ ] Throttled concurrent requests (max 3 simultaneous)
- [ ] Retry logic for failed chunks (up to 3 attempts)
- [ ] Real-time progress updates during upload
- [ ] Error handling for network failures
- [ ] Final upload summary with detailed results

#### Technical Requirements
- Efficient data chunking algorithm
- Progress tracking across multiple requests
- Request throttling and cancellation
- Robust error handling and retry logic
- Performance optimization for large datasets

#### AI Prompt for Implementation
```
I need to implement a chunked upload system for lead data with these requirements:

1. Convert mapped CSV data to JSON format with applied transformations
2. Split data into chunks of 500-1000 rows each
3. Upload chunks via POST requests to `/api/leads/bulk-upload-chunk`
4. Progress bar showing overall upload percentage
5. AbortController for upload cancellation
6. Throttle concurrent requests (max 3 simultaneous)
7. Retry failed chunks up to 3 times with exponential backoff
8. Real-time progress updates with estimated time remaining
9. Handle network errors gracefully
10. Collect and display final upload results (success/failed counts)

The upload should be performant and resilient. Include proper error boundaries and user feedback throughout the process. Use modern async/await patterns with proper error handling.

Please provide:
- Chunked upload service with progress tracking
- Request throttling and cancellation logic
- Retry mechanism with exponential backoff
- Progress UI component with cancellation
- Error handling and result summary
- TypeScript interfaces for upload responses
```

---

## Backend Tickets

### Ticket 5: Database Schema Updates
**Priority:** High | **Story Points:** 3 | **Type:** Technical Debt

#### Description
Add the missing `closedLostReason` field to the leads table, update the status enum to include "unprocessed", and create indexes for efficient duplicate detection.

#### Acceptance Criteria
- [ ] Add `closedLostReason` field to leads table (text, notNull)
- [ ] Add "unprocessed" status to lead status enum
- [ ] Create index on `name` field for duplicate detection
- [ ] Create composite index for tenant + name for scoped queries
- [ ] Database migration script with rollback
- [ ] Updated TypeScript types for lead schema
- [ ] Verify existing data compatibility

#### Technical Requirements
- Drizzle ORM migration
- Proper indexing strategy for performance
- Backward compatibility considerations
- Type safety updates

#### AI Prompt for Implementation
```
I need to update the database schema for a lead management system using Drizzle ORM. Here are the requirements:

1. Add `closedLostReason` field to the existing leads table:
   - Type: text
   - Constraint: notNull
   - Should be a required field for the bulk upload feature

2. Update the lead status enum to include "unprocessed" status:
   - This will be the initial status for bulk uploaded leads
   - Ensure it integrates with existing status values

3. Create database indexes for performance:
   - Index on `name` field for duplicate detection
   - Composite index on `tenantId` + `name` for scoped duplicate checking

4. Create proper migration script with rollback capability

5. Update TypeScript types to reflect schema changes

Looking at the existing schema in `/workspace/server/src/db/schema.ts`, please provide:
- Drizzle migration script to add the new field and indexes
- Updated schema definition with new field
- Updated TypeScript types/interfaces
- Migration rollback script
- Verification that changes don't break existing functionality
```

---

### Ticket 6: Bulk Upload API Endpoint
**Priority:** High | **Story Points:** 5 | **Type:** Feature

#### Description
Create a chunked upload API endpoint that accepts JSON payloads with mapping configuration, validates data, and returns structured results for each chunk.

#### Acceptance Criteria
- [ ] POST endpoint: `/api/leads/bulk-upload-chunk`
- [ ] Accept JSON payload with lead data and mapping config
- [ ] Request validation and sanitization
- [ ] Rate limiting to prevent abuse
- [ ] Structured error responses with field-level validation
- [ ] Support for chunked processing
- [ ] Return processing results per chunk
- [ ] Authentication and authorization checks
- [ ] Request logging for debugging

#### Technical Requirements
- Fastify route with proper validation schemas
- Request rate limiting
- Comprehensive input validation
- Structured error responses
- Authentication middleware integration

#### AI Prompt for Implementation
```
I need to create a bulk upload API endpoint using Fastify for a lead management system. Here are the requirements:

1. Create POST endpoint: `/api/leads/bulk-upload-chunk`

2. Request payload should include:
   - Array of lead data (chunk of 500-1000 records)
   - Mapping configuration (CSV column to lead field mappings)
   - Closed-lost reason configuration
   - Upload session ID for tracking

3. Implement comprehensive validation:
   - Validate all required lead fields are present
   - Sanitize and trim whitespace from all text fields
   - Validate data types (URLs, phone numbers, etc.)
   - Check payload size limits

4. Add security measures:
   - Rate limiting (max 10 requests per minute per user)
   - Authentication/authorization checks
   - Request sanitization
   - CORS handling

5. Return structured responses:
   - Success: processed count, validation errors, next steps
   - Error: detailed field-level validation errors
   - Status codes: 200 (success), 400 (validation), 429 (rate limit)

Please provide:
- Fastify route with validation schemas
- Request/response TypeScript interfaces
- Rate limiting middleware
- Comprehensive input validation
- Error handling with structured responses
- Authentication integration
```

---

### Ticket 7: Lead Processing & Deduplication
**Priority:** High | **Story Points:** 6 | **Type:** Feature

#### Description
Implement efficient lead processing with company name-based duplicate detection, data transformation, and batch database insertion using optimized queries.

#### Acceptance Criteria
- [ ] Efficient duplicate detection using indexed company name queries
- [ ] Whitespace trimming for all incoming fields
- [ ] Validation of all required fields per chunk
- [ ] Closed-lost reason logic application based on configuration
- [ ] Batch database insertion with conflict handling
- [ ] Detailed processing results (imported, skipped, failed counts)
- [ ] Performance optimization for large batches
- [ ] Transaction handling for data consistency
- [ ] Comprehensive logging for debugging

#### Technical Requirements
- Optimized database queries for duplicate detection
- Batch processing for performance
- Transaction management
- Comprehensive result reporting
- Error handling and logging

#### AI Prompt for Implementation
```
I need to implement lead processing and deduplication logic for bulk uploads. Here are the requirements:

1. Efficient duplicate detection:
   - Check for existing leads by company name within the same tenant
   - Use indexed queries for performance
   - Handle case-insensitive matching
   - Skip duplicates and track them in results

2. Data processing:
   - Trim whitespace from all text fields
   - Parse JSONB fields (products, services, differentiators, brandColors) from comma-separated strings
   - Apply closed-lost reason logic based on configuration:
     * Mode 1: Apply global reason to ALL leads
     * Mode 2: Apply global reason only to leads with missing/invalid reasons
   - Set status to "unprocessed" for all new leads
   - Auto-populate system fields (id, tenantId, createdAt, updatedAt)

3. Database operations:
   - Use batch insertion for performance
   - Handle conflicts with `INSERT ... ON CONFLICT DO NOTHING`
   - Wrap in database transactions for consistency
   - Return detailed results: imported count, skipped count, failed count with reasons

4. Performance optimizations:
   - Process in batches of 500-1000 records
   - Use prepared statements where possible
   - Minimize database round trips
   - Efficient memory usage

Please provide:
- Lead processing service with deduplication logic
- Batch database insertion with conflict handling
- Data transformation utilities
- Comprehensive result reporting
- Error handling and logging
- Performance optimizations using Drizzle ORM
```

---

## Integration & Polish

### Ticket 8: Error Handling & User Experience
**Priority:** Medium | **Story Points:** 4 | **Type:** Enhancement

#### Description
Implement comprehensive error handling, real-time progress feedback, detailed result summaries, and graceful handling of edge cases throughout the upload flow.

#### Acceptance Criteria
- [ ] Comprehensive error messages for all validation failures
- [ ] Real-time upload progress with estimated time remaining
- [ ] Final upload summary with detailed results breakdown
- [ ] Download option for failed/skipped records with reasons
- [ ] Graceful handling of network interruptions
- [ ] Loading states for all async operations
- [ ] Toast notifications for important events
- [ ] Help tooltips and documentation links
- [ ] Accessibility compliance (WCAG 2.1)

#### Technical Requirements
- Error boundary components
- Progress calculation algorithms
- Export functionality for failed records
- Offline/network handling
- Accessibility features

#### AI Prompt for Implementation
```
I need to implement comprehensive error handling and user experience improvements for the bulk upload feature. Here are the requirements:

1. Error Handling:
   - Comprehensive error messages for validation failures
   - Field-level error highlighting in the preview table
   - Network error handling with retry suggestions
   - File parsing error explanations
   - Rate limiting error messages with wait times

2. Progress & Feedback:
   - Real-time progress bar with percentage and estimated time
   - Current chunk status (uploading, processing, complete)
   - Success/error notifications using toast system
   - Loading states for all async operations
   - Cancel confirmation dialog

3. Results Summary:
   - Detailed breakdown: imported, skipped, failed counts
   - Expandable sections showing specific errors
   - Download CSV of failed/skipped records with reasons
   - Success celebration for completed uploads
   - Next steps guidance after upload

4. Edge Cases:
   - Network interruption handling
   - Browser refresh/close warnings during upload
   - Large file timeout handling
   - Memory management for huge datasets
   - Graceful degradation for older browsers

5. Accessibility & UX:
   - WCAG 2.1 compliance
   - Keyboard navigation support
   - Screen reader optimization
   - Help tooltips and documentation
   - Mobile responsive design

Please provide:
- Error boundary components
- Progress tracking with time estimation
- Results summary with export functionality
- Toast notification system
- Accessibility improvements
- Comprehensive error messaging
```

---

## Development Notes

### Dependencies Order
1. **Ticket 5** (Database Schema) - Must be completed first
2. **Ticket 1** (File Upload) - Can start in parallel with schema
3. **Ticket 2** (Preview/Mapping) - Depends on Ticket 1
4. **Ticket 6** (API Endpoint) - Can start after schema is complete
5. **Ticket 3** (Closed-Lost Config) - Depends on Ticket 2
6. **Ticket 7** (Processing) - Depends on Ticket 6
7. **Ticket 4** (Chunked Upload) - Depends on Tickets 2, 3, 6, 7
8. **Ticket 8** (Error Handling) - Final polish across all features

### Technical Stack
- **Frontend:** React, TypeScript, PapaParse, Web Workers
- **Backend:** Fastify, Drizzle ORM, PostgreSQL
- **File Processing:** PapaParse for CSV, SheetJS for Excel
- **Performance:** Chunked processing, indexed queries, batch operations

### Testing Strategy
- Unit tests for data processing logic
- Integration tests for API endpoints
- E2E tests for complete upload flow
- Performance tests with large datasets
- Error scenario testing

---

*This ticket breakdown provides a comprehensive roadmap for implementing the Closed-Lost Lead Revival feature with detailed AI prompts for each component.*