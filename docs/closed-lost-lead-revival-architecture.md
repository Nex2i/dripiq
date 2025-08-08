### Closed-Lost Lead Revival: Planned Architecture (DripIQ Codebase-Aligned)

#### Overview
- **Goal**: Let users upload CSV/Excel lists of Closed-Lost leads and auto-trigger multi-channel revival campaigns without overwhelming the system or degrading lead quality.
- **Fit**: Integrates cleanly into existing Fastify + Drizzle backend, React/TypeScript frontend, and repository/service-based server modules.
- **Data model**: Adds `closedLostReason` to `leads`, uses existing `lead_statuses` table with `LEAD_STATUS.UNPROCESSED`.

---

### High-Level Flow
1. User uploads CSV/Excel on a new upload page.
2. Frontend parses in a Web Worker (PapaParse / SheetJS), shows 10-row preview, header toggle, and column mapping to lead fields.
3. User sets Closed-Lost Reason behavior (apply to all vs. only missing/invalid).
4. Frontend transforms data to JSON (trim + parse JSONB-like fields) and chunk-uploads (500–1000 rows) with throttling, retries, and progress.
5. Backend validates, deduplicates by tenant+name, applies closed-lost logic, inserts in batch, returns per-chunk results.
6. Frontend provides progress, errors, and final summary with export of skipped/failed rows.

---

### Repository Placement

- **Frontend (React/TypeScript)**
  - `client/src/pages/ClosedLostUploadPage.tsx` (main page: drag-drop, validation, preview, mapping)
  - `client/src/components/upload/FileUpload.tsx` (file input + drag-drop)
  - `client/src/components/upload/PreviewMappingTable.tsx` (table + mapping controls)
  - `client/src/components/upload/ClosedLostReasonConfig.tsx` (radio + text input + live validation)
  - `client/src/components/upload/UploadProgress.tsx` (progress, ETA, cancel)
  - `client/src/workers/csvParser.worker.ts` (CSV/Excel parsing worker)
  - `client/src/services/upload/chunkedUpload.service.ts` (throttle, retry, progress, cancellation)
  - `client/src/types/upload.ts` (interfaces: mapping, config, chunked results)

- **Backend (Fastify/Drizzle/PostgreSQL)**
  - `server/src/db/migrations/00xx_add_closed_lost_reason.sql` (column + indexes)
  - `server/src/db/schema.ts` (add `closedLostReason`; optional indexes)
  - `server/src/routes/apiSchema/lead/bulkUpload.schema.ts` (TypeBox request/response)
  - `server/src/routes/lead.bulkUpload.routes.ts` (POST `/leads/bulk-upload-chunk`)
  - `server/src/modules/bulkUpload.service.ts` (validation, transform, dedupe, batch insert)
  - Optional: `server/src/plugins/rateLimit.plugin.ts` (register `@fastify/rate-limit`)

---

### Data Model Changes (Ticket 5)
- **Add** `closedLostReason text NOT NULL` to `leads`.
- **Indexes**:
  - `CREATE INDEX lead_name_idx ON leads(name)`
  - `CREATE INDEX lead_tenant_name_idx ON leads(tenant_id, name)`
- **Status**: use existing `LEAD_STATUS.UNPROCESSED` for newly imported leads (already defined).
- **Migration** style matches `server/src/db/migrations/*.sql`.

Example migration (new file: `server/src/db/migrations/00xx_add_closed_lost_reason.sql`):

```sql
-- Add column as nullable, backfill, then set NOT NULL for safety with existing data
ALTER TABLE "dripiq_app"."leads" ADD COLUMN IF NOT EXISTS "closed_lost_reason" text;
UPDATE "dripiq_app"."leads"
SET "closed_lost_reason" = COALESCE("closed_lost_reason", 'Not Provided');
ALTER TABLE "dripiq_app"."leads" ALTER COLUMN "closed_lost_reason" SET NOT NULL;

-- Indexes for duplicate detection and scoped queries
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "lead_name_idx" ON "dripiq_app"."leads" ("name");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "lead_tenant_name_idx" ON "dripiq_app"."leads" ("tenant_id","name");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
```

Schema update (`server/src/db/schema.ts`, inside `leads` table):

```ts
closedLostReason: text('closed_lost_reason').notNull(),
```

Optional: also declare indexes in schema (to keep Drizzle model consistent):

```ts
// after table definition
(table) => [
  index('lead_name_idx').on(table.name),
  index('lead_tenant_name_idx').on(table.tenantId, table.name),
]
```

Type updates:
- `export type Lead` already generated; adding field updates inferred types automatically.

Rollback notes:
- Drop indexes if exist; set column nullable or drop if needed.
- Provide a separate `.sql` rollback file if your process requires explicit down migrations.

---

### API Design (Ticket 6)
- **Route**: POST `/api/leads/bulk-upload-chunk` (loaded as `/leads/bulk-upload-chunk` in route file; `/api` is prefixed by app)
- **Auth**: Use `fastify.authPrehandler`
- **Rate limiting**: `@fastify/rate-limit` (10 req/min per user)
- **Validation**: TypeBox schemas; sanitize/trim; enforce required fields; size guard

Request payload (TypeScript):

```ts
type ClosedLostReasonMode = 'ALL' | 'MISSING_ONLY';

interface MappingConfig {
  // csv column name (key) -> lead field (value)
  [csvColumn: string]: 'name' | 'url' | 'summary' | 'products' | 'services' | 'differentiators' | 'targetMarket' | 'tone' | 'brandColors' | 'closedLostReason';
}

interface ClosedLostReasonConfig {
  mode: ClosedLostReasonMode;     // 'ALL' or 'MISSING_ONLY'
  globalReason: string;           // required non-empty string
}

interface BulkUploadChunkRequest {
  sessionId: string;              // uuid-like
  mapping: MappingConfig;
  reasonConfig: ClosedLostReasonConfig;
  rows: Array<Record<string, string | null>>; // post-mapped values or raw column names applied by frontend
}

interface BulkUploadChunkResponse {
  processedCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ rowIndex: number; field?: string; message: string }>;
  skipped: Array<{ rowIndex: number; reason: string }>;
}
```

Validation highlights:
- **Required**: `name`, `url`, `summary`, `products`, `services`, `differentiators`, `targetMarket`, `tone`, `brandColors`, `closedLostReason`
- **Sanitize**: trim all text; validate URL; parse JSONB-ish fields (comma-separated -> arrays)
- **Limits**: payload size; rows per chunk; per-user rate limit; CORS already configured

---

### Backend Processing (Ticket 7)
- **Service**: `bulkUpload.service.ts`
  - Transform:
    - Trim strings
    - Normalize URL
    - Parse `products/services/differentiators/brandColors` from comma-separated to arrays
  - Closed-lost reason:
    - Mode `ALL`: override every row with `globalReason`
    - Mode `MISSING_ONLY`: set only when existing is missing/invalid
  - Dedup:
    - Case-insensitive match on `tenant_id` + `name`
    - Use `lead_tenant_name_idx`
  - Insert:
    - Batch insert with `INSERT ... ON CONFLICT DO NOTHING`
    - New leads get `LEAD_STATUS.UNPROCESSED` in `lead_statuses`
  - Transaction:
    - Wrap per-chunk operations in a transaction
  - Result aggregation:
    - Keep detailed imported/skipped/failed counts, errors by row

- **Logging & errors**:
  - Use existing `logger`
  - Structured responses with field-level errors

---

### Frontend UX (Tickets 1–4)
- **File Upload & Parsing**
  - Accept `.csv, .xls, .xlsx`; 10MB max; 10k rows max
  - Libraries: PapaParse (CSV), SheetJS (Excel)
  - Web Worker for parsing; show progress + non-blocking UI
  - Checkbox for “Has header” (affects preview and mapping)

- **Preview & Mapping**
  - Table shows first 10 rows (excluding header if checked)
  - Per-column dropdown maps to:
    - Required: `name`, `url`, `summary`, `products`, `services`, `differentiators`, `targetMarket`, `tone`, `brandColors`, `closedLostReason`
  - Real-time validation: all required mapped before proceeding
  - Trimming preview; JSONB fields show how comma-separated values parse
  - Reset/clear mapping

- **Closed-Lost Reason Config**
  - Radios: Apply to ALL vs MISSING/INVALID only
  - Text input: global reason (required)
  - Live validation ensuring all rows end with a reason
  - Immediate preview update

- **Chunked Upload & Progress**
  - Convert mapped data to JSON with applied transforms
  - Chunk: 500–1000 rows; throttle max 3 concurrent
  - Retry: up to 3 attempts, exponential backoff
  - Cancellation: `AbortController`
  - UI: progress %, ETA, current chunk status; final summary

---

### Error Handling & UX Polish (Ticket 8)
- **Error Boundary** components around upload/preview
- **Toast notifications** (success/error, rate limiting with wait times)
- **Detailed summary**: imported/skipped/failed, expandable row errors
- **Export CSV** of failed/skipped with reasons
- **Network resilience**: retries, cancel dialog, refresh warnings, offline handling
- **Accessibility**: keyboard navigation, aria-live for progress, color contrast, focus management
- **Responsive** layout for large tables

---

### Security & Performance
- **Security**:
  - Auth prehandler; per-tenant scoping on all operations
  - Rate limit 10 req/min per user for chunk endpoint
  - Schema validation + sanitization; CORS already in place
- **Performance**:
  - Client-side parsing via Worker; chunking/throttling
  - DB indexes for dedupe
  - Batch inserts, minimized round trips
  - Prepared statements where feasible

---

### Testing Strategy
- **Unit**:
  - Parsing/trimming/JSONB parsing utils
  - Reason application logic (ALL vs MISSING_ONLY)
  - Dedup logic (case-insensitive, tenant-scoped)
- **Integration**:
  - API endpoint validation, rate limiting, auth
  - Batch insert and conflict handling
- **E2E**:
  - Full upload flow: file → mapping → reason config → chunked upload → summary
- **Performance**:
  - 10k rows end-to-end; throttle/ETA correctness
- **Error scenarios**:
  - Corrupted CSV/Excel; network interruptions; rate limited; server errors

---

### Example API Schema (TypeBox) and Route Skeleton

- `server/src/routes/apiSchema/lead/bulkUpload.schema.ts`

```ts
import { Type } from '@sinclair/typebox';

export const ClosedLostReasonConfigSchema = Type.Object({
  mode: Type.Union([Type.Literal('ALL'), Type.Literal('MISSING_ONLY')]),
  globalReason: Type.String({ minLength: 1 }),
});

export const MappingConfigSchema = Type.Record(Type.String(), Type.String());

export const BulkUploadChunkRequestSchema = Type.Object({
  sessionId: Type.String({ minLength: 8 }),
  mapping: MappingConfigSchema,
  reasonConfig: ClosedLostReasonConfigSchema,
  rows: Type.Array(Type.Record(Type.String(), Type.Union([Type.String(), Type.Null()]))),
});

export const BulkUploadChunkResponseSchema = Type.Object({
  processedCount: Type.Number(),
  importedCount: Type.Number(),
  skippedCount: Type.Number(),
  failedCount: Type.Number(),
  errors: Type.Array(Type.Object({
    rowIndex: Type.Number(),
    field: Type.Optional(Type.String()),
    message: Type.String(),
  })),
  skipped: Type.Array(Type.Object({
    rowIndex: Type.Number(),
    reason: Type.String(),
  })),
});
```

- `server/src/routes/lead.bulkUpload.routes.ts`

```ts
import { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from 'fastify';
import { HttpMethods } from '@/utils/HttpMethods';
import { BulkUploadChunkRequestSchema, BulkUploadChunkResponseSchema } from './apiSchema/lead/bulkUpload.schema';
import { bulkUploadService } from '@/modules/bulkUpload.service';
import { defaultRouteResponse } from '@/types/response';
import rateLimit from '@fastify/rate-limit';
import { AuthenticatedRequest } from '@/plugins/authentication.plugin';

export default async function LeadBulkUploadRoutes(fastify: FastifyInstance, _opts: RouteOptions) {
  await fastify.register(rateLimit, { max: 10, timeWindow: '1 minute' });

  fastify.route({
    method: HttpMethods.POST,
    url: '/leads/bulk-upload-chunk',
    preHandler: [fastify.authPrehandler],
    schema: {
      tags: ['Leads'],
      summary: 'Bulk Upload Leads (Chunk)',
      body: BulkUploadChunkRequestSchema,
      response: {
        ...defaultRouteResponse(),
        200: BulkUploadChunkResponseSchema,
      },
    },
    handler: async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const { tenantId } = request as AuthenticatedRequest;
      const result = await bulkUploadService.processChunk(tenantId, request.body);
      reply.status(200).send(result);
    },
  });
}
```

---

### Dependencies & Libraries
- **Frontend**:
  - `papaparse`, `xlsx` (SheetJS), `react` + `typescript`
- **Backend**:
  - `@fastify/type-provider-typebox`, `@sinclair/typebox`, `@fastify/rate-limit`
- **Reuse**:
  - Existing `LEAD_STATUS` constants; `leadStatusRepository`, `leadRepository`, transaction repositories; `logger`; auth plugin.

---

### Ticket-to-Implementation Mapping

- **Ticket 5 (Schema) [first]**:
  - Migration SQL file + `schema.ts` update for `closedLostReason`; add DB indexes.
- **Ticket 1 (Upload UI)**:
  - `ClosedLostUploadPage.tsx`, `FileUpload.tsx`, `csvParser.worker.ts`
- **Ticket 2 (Preview/Mapping)**:
  - `PreviewMappingTable.tsx`, mapping validation/types in `client/src/types/upload.ts`
- **Ticket 6 (API Endpoint)**:
  - `lead.bulkUpload.routes.ts`, `bulkUpload.schema.ts`
- **Ticket 3 (Closed-Lost Config)**:
  - `ClosedLostReasonConfig.tsx`, live preview integration
- **Ticket 7 (Processing)**:
  - `bulkUpload.service.ts` with batch insert + dedupe + status creation
- **Ticket 4 (Chunked Upload)**:
  - `chunkedUpload.service.ts`, `UploadProgress.tsx`
- **Ticket 8 (Polish)**:
  - Error boundaries, toasts, summary export, accessibility pass

---

- Added where new frontend and backend modules go, schema changes, API contracts, and UX/system behavior per ticket.
- Confirmed status handling aligns with existing `LEAD_STATUS.UNPROCESSED`. 
- Provided migration SQL, route/schema skeletons, and types to accelerate implementation.

---

### Detailed Ticket Breakdown

#### Ticket 1: File Upload Interface & Validation
- **Priority**: High | **Story Points**: 5 | **Type**: Feature
- **Acceptance Criteria**:
  - Dedicated upload page via main navigation
  - Accepts only .csv, .xls, .xlsx; size <= 10MB; rows <= 10k
  - PapaParse integration for CSV; SheetJS for Excel
  - Processing in a Web Worker with progress/loading states
  - Errors for invalid/corrupted files and constraints
  - First 10 rows prepared for preview
- **Technical Requirements**:
  - PapaParse + Web Worker
  - SheetJS for `.xls/.xlsx`
  - File type/size/row count guards pre-parse
- **Deliverables**:
  - `ClosedLostUploadPage.tsx`, `FileUpload.tsx`, `csvParser.worker.ts`

#### Ticket 2: Preview Table & Column Mapping
- **Priority**: High | **Story Points**: 8 | **Type**: Feature
- **Acceptance Criteria**:
  - Preview shows first 10 rows (respects header checkbox)
  - Mapping dropdowns for each CSV column
  - Required fields mapped: name, url, summary, products, services, differentiators, targetMarket, tone, brandColors, closedLostReason
  - Real-time validation + visual indicators; reset mapping
  - Trimmed whitespace shown; JSONB parsing preview
  - Responsive table
- **Technical Requirements**:
  - Dynamic table + mapping controls
  - Live validation feedback
  - Data transformation preview
- **Deliverables**:
  - `PreviewMappingTable.tsx`, `client/src/types/upload.ts`

#### Ticket 3: Closed-Lost Reason Configuration
- **Priority**: Medium | **Story Points**: 3 | **Type**: Feature
- **Acceptance Criteria**:
  - Radio: Apply to ALL vs MISSING/INVALID
  - Global reason text input (required)
  - Live validation ensures every lead ends with a reason
  - Preview updates reflect configuration
- **Technical Requirements**:
  - Form validation and clear UX copy
- **Deliverables**:
  - `ClosedLostReasonConfig.tsx`

#### Ticket 4: Chunked Upload & Progress
- **Priority**: High | **Story Points**: 6 | **Type**: Feature
- **Acceptance Criteria**:
  - Chunk 500–1000 rows; concurrent max 3
  - Progress bar with percent and ETA; cancel via AbortController
  - Retry failed chunks up to 3 with backoff
  - Final summary (success/failed counts)
- **Technical Requirements**:
  - Efficient chunking; throttling; cancellation
  - Resilient error handling
- **Deliverables**:
  - `chunkedUpload.service.ts`, `UploadProgress.tsx`

#### Ticket 5: Database Schema Updates
- **Priority**: High | **Story Points**: 3 | **Type**: Technical Debt
- **Acceptance Criteria**:
  - Add `closed_lost_reason` (text not null) to `leads`
  - Index on `name`; composite index on `tenant_id, name`
  - Migration with rollback; TS types updated
- **Deliverables**:
  - `00xx_add_closed_lost_reason.sql`, `schema.ts` updates

#### Ticket 6: Bulk Upload API Endpoint
- **Priority**: High | **Story Points**: 5 | **Type**: Feature
- **Acceptance Criteria**:
  - POST `/api/leads/bulk-upload-chunk`
  - Validates mapping + required fields; sanitizes
  - Rate limiting 10/min; auth; structured errors
  - Returns per-chunk results
- **Deliverables**:
  - `lead.bulkUpload.routes.ts`, `bulkUpload.schema.ts`

#### Ticket 7: Lead Processing & Deduplication
- **Priority**: High | **Story Points**: 6 | **Type**: Feature
- **Acceptance Criteria**:
  - Case-insensitive dedupe on tenant+name
  - Trim/transform fields; parse JSONB comma-separated
  - Apply closed-lost reason per configuration
  - Batch insert with conflicts handled; transactions
  - Detailed results and logging
- **Deliverables**:
  - `bulkUpload.service.ts`, transformation utilities

#### Ticket 8: Error Handling & User Experience
- **Priority**: Medium | **Story Points**: 4 | **Type**: Enhancement
- **Acceptance Criteria**:
  - Comprehensive error messaging and field-level highlights
  - Real-time progress + ETA; cancel confirm
  - Download CSV of failed/skipped with reasons
  - Accessibility and responsive design
- **Deliverables**:
  - Error boundaries, toast system, summary/export components

---

### TypeScript Interfaces (Frontend)

```ts
// client/src/types/upload.ts
export type RequiredLeadField =
  | 'name'
  | 'url'
  | 'summary'
  | 'products'
  | 'services'
  | 'differentiators'
  | 'targetMarket'
  | 'tone'
  | 'brandColors'
  | 'closedLostReason';

export type ClosedLostReasonMode = 'ALL' | 'MISSING_ONLY';

export interface MappingConfig {
  [csvColumn: string]: RequiredLeadField;
}

export interface ClosedLostReasonConfig {
  mode: ClosedLostReasonMode;
  globalReason: string; // non-empty
}

export interface PreviewRow {
  [csvColumn: string]: string | null;
}

export interface UploadRow {
  name: string;
  url: string;
  summary: string;
  products: string[];
  services: string[];
  differentiators: string[];
  targetMarket: string;
  tone: string;
  brandColors: string[];
  closedLostReason: string;
}

export interface ChunkResultError {
  rowIndex: number;
  field?: string;
  message: string;
}

export interface ChunkResultSkipped {
  rowIndex: number;
  reason: string;
}

export interface BulkUploadChunkResponse {
  processedCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: ChunkResultError[];
  skipped: ChunkResultSkipped[];
}
```

---

### Frontend Navigation & Components
- Add navigation entry to `ClosedLostUploadPage.tsx` from `Leads` views (e.g., button in `LeadsPage.tsx` header: "Bulk Upload Closed-Lost" leading to `/leads/bulk-upload`).
- Components:
  - `FileUpload.tsx`: drag-drop zone, file validation, worker invocation
  - `PreviewMappingTable.tsx`: mapping dropdowns, validation badges, trimming preview
  - `ClosedLostReasonConfig.tsx`: radio group + input with live validation
  - `UploadProgress.tsx`: overall progress, chunk status, ETA, cancel button

Route example: `/leads/bulk-upload` using existing router patterns.

---

### Backend Contracts & Service Signatures

```ts
// server/src/modules/bulkUpload.service.ts
export interface ProcessChunkInput {
  sessionId: string;
  tenantId: string;
  mapping: Record<string, string>;
  reasonConfig: { mode: 'ALL' | 'MISSING_ONLY'; globalReason: string };
  rows: Array<Record<string, string | null>>;
}

export interface ProcessChunkResult {
  processedCount: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ rowIndex: number; field?: string; message: string }>;
  skipped: Array<{ rowIndex: number; reason: string }>;
}

export const bulkUploadService = {
  async processChunk(tenantId: string, payload: ProcessChunkInput): Promise<ProcessChunkResult> {
    // validate -> transform -> dedupe -> batch insert (transaction) -> return results
    return {
      processedCount: 0,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
      skipped: [],
    };
  },
};

// Utility signatures
export function transformRow(
  raw: Record<string, string | null>,
  mapping: Record<string, string>,
  reasonConfig: { mode: 'ALL' | 'MISSING_ONLY'; globalReason: string }
): UploadRow { /* ... */ }

export async function findDuplicatesByTenantName(
  tenantId: string,
  names: string[]
): Promise<Set<string>> { /* returns lowercased names that already exist */ }
```

---

### Migration Rollback Example

```sql
-- server/src/db/migrations/00xx_add_closed_lost_reason_down.sql
ALTER TABLE "dripiq_app"."leads" ALTER COLUMN "closed_lost_reason" DROP NOT NULL;
ALTER TABLE "dripiq_app"."leads" DROP COLUMN IF EXISTS "closed_lost_reason";

DO $$ BEGIN
  DROP INDEX IF EXISTS "lead_tenant_name_idx";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  DROP INDEX IF EXISTS "lead_name_idx";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
```

---

### Testing Plan Details
- **Unit**:
  - `transformRow` trims and parses arrays correctly
  - Closed-lost reason modes produce expected values
  - URL normalization
- **Integration**:
  - Endpoint schema validation: missing fields, bad URLs, oversize payload
  - Rate-limit behavior (429 with wait time)
  - Transactional batch insert with conflict handling
- **E2E**:
  - Happy path from upload → mapping → reason config → chunked upload → summary
  - Large dataset (10k rows) with mixed duplicates and errors
- **Performance**:
  - Verify <3 concurrent requests; backoff timings; ETA within tolerance
- **Accessibility**:
  - Keyboard navigation in table and forms; screen reader labels; contrast

---

### Risks & Mitigations
- **Large files causing memory pressure**: Use streaming parse in worker; chunk early; avoid retaining full dataset in memory.
- **Duplicate detection accuracy**: Normalize case and whitespace; consider additional keys (url) if needed in future.
- **User confusion on mapping**: Provide defaults via header matching; strong visual cues and validation messages.
- **Rate limit collisions**: Client throttling (max 3 concurrent) + server rate limit; queue excess.
- **Schema NOT NULL backfill**: Two-step migration ensures legacy rows get a safe default value before enforcing NOT NULL.

---

### Delivery Milestones
- Week 1: Ticket 5 + Ticket 1 foundations (UI skeleton, worker, validation)
- Week 2: Ticket 2 + Ticket 3 (preview/mapping + reason config)
- Week 3: Ticket 6 + Ticket 7 (endpoint + processing)
- Week 4: Ticket 4 + Ticket 8 (chunked upload + UX polish, testing, accessibility)